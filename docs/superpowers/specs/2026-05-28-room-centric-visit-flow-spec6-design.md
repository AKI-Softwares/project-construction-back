# Spec 6 — Room-Centric Visit Flow Design

**Date:** 2026-05-28
**Branch:** feat/room-centric-visit (to create)
**Status:** approved
**Depends on:** Spec 3 (Checklist, Visit, VisitItem), Spec 4/5 (NonConformity, Photo)

---

## Overview

Spec 6 enforces a room-by-room inspection discipline on the Visit flow. Currently, a `Visit` exposes all `VisitItem`s as a flat list and imposes no order constraints — the inspector can evaluate any item in any room at any time. This spec introduces:

1. **Room-completion guard** — once the inspector evaluates any item in a room, all items in that room must be evaluated (OK or NOK) before the inspector can evaluate items in another room.
2. **Immediate NC guard** — before the inspector can evaluate the next item in a room, all existing NOK items in that room must have a `NonConformity` recorded.
3. **Room-grouped GET response** — `GET /visits/:id` returns items grouped by `ApartmentRoom` instead of a flat array, including per-room completion state.
4. **Remove PENDING from VisitItem** — the evaluator has only two states: OK and NOK. "Not yet evaluated" is represented by `null`.

`ChecklistItem.status` retains PENDING (aggregate state used internally). Only `VisitItem.status` changes.

---

## Domain Vocabulary

| Term | Meaning |
|---|---|
| **Room in progress** | An `ApartmentRoom` that has ≥1 evaluated VisitItem (non-null) AND ≥1 unevaluated VisitItem (null) within the current visit |
| **Room complete** | All VisitItems for that room have non-null status (OK or NOK) |
| **Room untouched** | All VisitItems for that room are null |
| **EvaluationStatus** | New enum: `OK \| NOK`. Replaces `ChecklistItemStatus` on `VisitItem.status` |

---

## Schema Changes

### New enum: `EvaluationStatus`

```prisma
enum EvaluationStatus {
  OK
  NOK
}
```

### Updated: `VisitItem`

```prisma
model VisitItem {
  id              Int               @id @default(autoincrement())
  visitId         Int               @map("visit_id")
  checklistItemId Int               @map("checklist_item_id")
  status          EvaluationStatus?                          // null = not yet evaluated
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  visit           Visit             @relation(fields: [visitId], references: [id], onDelete: Cascade)
  checklistItem   ChecklistItem     @relation(fields: [checklistItemId], references: [id], onDelete: Restrict)
  nonConformity   NonConformity?

  @@unique([visitId, checklistItemId])
  @@index([checklistItemId])
  @@map("VisitItem")
}
```

**Changes from current:**
- `status` type: `ChecklistItemStatus @default(PENDING)` → `EvaluationStatus?` (nullable, no default)
- `null` is the canonical "not yet evaluated" state — no PENDING value for VisitItem

### No changes to other models

`ChecklistItem.status` keeps `ChecklistItemStatus @default(PENDING)` — it reflects the aggregate result after visit finalization, not the inspector's in-field state.

### Migration notes

```sql
CREATE TYPE "EvaluationStatus" AS ENUM ('OK', 'NOK');

ALTER TABLE "VisitItem"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EvaluationStatus"
    USING CASE
      WHEN "status" = 'PENDING' THEN NULL
      ELSE "status"::text::"EvaluationStatus"
    END,
  ALTER COLUMN "status" DROP NOT NULL;
```

Existing PENDING rows become NULL. Existing OK/NOK rows are cast directly. Safe for production.

---

## API Changes

### No new routes

All changes are behavioral (guards + response shape) on existing endpoints.

### `GET /visits/:id` — response shape changes

**Before:** flat `items[]`

**After:** `rooms[]` — each room contains its items, completion state, and per-item NC + photos.

```json
{
  "id": 1,
  "checklistId": 3,
  "status": "ONGOING",
  "observations": null,
  "finalizedAt": null,
  "createdAt": "...",
  "inspector": { "id": 2, "name": "João" },
  "rooms": [
    {
      "id": 5,
      "name": "Sala",
      "isComplete": false,
      "items": [
        {
          "id": 10,
          "serviceId": 3,
          "serviceName": "Pintura",
          "status": "NOK",
          "nonConformity": {
            "id": 7,
            "description": "Mancha na parede",
            "photos": [{ "id": 1, "url": "https://..." }]
          }
        },
        {
          "id": 11,
          "serviceId": 4,
          "serviceName": "Rejunte",
          "status": null,
          "nonConformity": null
        }
      ]
    }
  ]
}
```

`isComplete`: derived — `true` when all items in that room have non-null status.

### `PATCH /visits/:id/items/:itemId` — two new guards

**Guard 1 — Room in progress (switch block):**

```
Target item belongs to room T.
Find all rooms in this visit that are "in progress"
  (in-progress = has ≥1 non-null item AND ≥1 null item).

If any in-progress room ≠ T → 409 "Finish current room before switching."
```

Rule: inspector is free to choose any untouched room or continue the room already in progress. Cannot start room B while room A is partially done.

**Guard 2 — NOK without NC (advance block):**

```
Target item belongs to room T.
Find all items in room T where status = NOK AND nonConformity = null.
Exclude the current item being updated (it may be the one being set to NOK right now).

If any such item exists → 409 "Record non-conformity for all NOK items before proceeding."
```

Rule: inspector cannot move to any next item while a previous NOK item in the same room is missing its NC.

**Updated schema validation:**

`updateVisitItemSchema` body: remove `PENDING` from accepted values. Only `OK` and `NOK` are valid inputs.

### `PATCH /visits/:id` (finalize) — update null check

```ts
// Before:
const pendingItems = visit.items.filter((i) => i.status === "PENDING");

// After:
const unevaluatedItems = visit.items.filter((i) => i.status === null);
if (unevaluatedItems.length > 0) {
  throw new HttpError(400, "All items must be evaluated before finalizing.");
}
```

---

## Business Logic

### Guard 1 — Room in progress (detail)

Evaluated in `VisitService.updateVisitItem` before applying the update.

```
1. Resolve target ApartmentRoom T via:
   VisitItem → ChecklistItem → ApartmentRoomService → ApartmentRoom

2. Build room map: group all visit items by their ApartmentRoomId

3. For each room R ≠ T:
   in_progress(R) = R has at least one item with status ≠ null
                 AND at least one item with status = null
   if in_progress(R) → throw 409

4. Proceed with update.
```

### Guard 2 — NOK without NC (detail)

Evaluated in `VisitService.updateVisitItem` after Guard 1 passes.

```
1. Get all items in room T (same room as target item).
2. Filter: status = NOK AND nonConformity = null AND id ≠ itemId.
3. If any match → throw 409.
4. Proceed with update.
```

Note: when the inspector marks the current item as NOK, Guard 2 does not block it — the item itself is allowed to become NOK. The block only applies on the *next* action while an unresolved NOK exists.

### Repository: `findById` — include room info

`visit.repository.ts` `findById` must include room data for guards and grouped response:

```ts
items: {
  include: {
    checklistItem: {
      include: {
        apartmentRoomService: {
          include: {
            apartmentRoom: true,  // needed for guards + grouping
            service: true         // needed for response
          }
        }
      }
    },
    nonConformity: {
      include: { photos: true }
    }
  }
}
```

### Response mapper: `visit.controller.ts`

Raw Prisma result is flat items. Controller (or service) maps to room-grouped shape before returning:

```ts
function groupByRoom(items: VisitItemWithRoom[]) {
  const map = new Map<number, RoomGroup>();
  for (const item of items) {
    const room = item.checklistItem.apartmentRoomService.apartmentRoom;
    if (!map.has(room.id)) {
      map.set(room.id, { id: room.id, name: room.name, isComplete: true, items: [] });
    }
    const group = map.get(room.id)!;
    if (item.status === null) group.isComplete = false;
    group.items.push(mapItem(item));
  }
  return Array.from(map.values());
}
```

---

## Error Handling

| Situation | Code | Message |
|---|---|---|
| Evaluate item in room B while room A in progress | 409 | "Finish current room before switching." |
| Evaluate next item while room has NOK without NC | 409 | "Record non-conformity for all NOK items before proceeding." |
| Finalize visit with null (unevaluated) items | 400 | "All items must be evaluated before finalizing." |
| Update item with status PENDING | 422 | Zod validation error |

Existing error cases from Spec 3 remain unchanged.

---

## Files to Change

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `EvaluationStatus` enum; update `VisitItem.status` to `EvaluationStatus?` |
| `prisma/migrations/...` | New migration for enum + column change |
| `src/modules/visit/visit.schema.ts` | Remove PENDING from `updateVisitItemSchema`; update `VisitItem` type |
| `src/modules/visit/visit.repository.ts` | Expand `findById` include to fetch `apartmentRoom` + `service` |
| `src/modules/visit/visit.service.ts` | Add Guard 1, Guard 2; update finalization null check |
| `src/modules/visit/visit.controller.ts` | Map flat items → room-grouped response in `getOne` |

No new modules, no new routes, no RBAC changes.

---

## Out of Scope (Spec 6)

- Inspector can choose **which room** to start — no forced room order. Free choice among untouched rooms.
- The constraint is **within a visit** only. Multiple visits on the same checklist are independent.
- No room-level `status` field on the DB — derived at query time via `isComplete`.
- GET `/visits/:id` list endpoint (`GET /checklists/:id/visits`) returns summary only — no room grouping needed there.
- Reordering services within a room — no `order` field added (out of scope per design decision).

---

## Related

- [[2026-05-25-inspection-spec3-design]] — Visit, VisitItem, ChecklistItem base
- [[2026-05-26-photo-upload-spec4-design]] — NonConformity, Photo upload
- [[2026-05-26-cloudinary-cleanup-spec5-design]] — MIME sniffing, publicId
