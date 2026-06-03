# Spec 7 — Mobile Inspector Support Design

**Date:** 2026-06-02
**Branch:** to create from dev
**Status:** approved
**Depends on:** Spec 3 (Visit, VisitItem), Spec 6 (room-centric flow)

---

## Overview

Spec 7 closes the mobile inspector gap. After Specs 1–6, an inspector can evaluate items, record non-conformities, and upload photos — but has no way to discover their own visits. This spec adds visit discovery, apartment/building context on visit responses, and a three-state visit lifecycle (`NOT_STARTED → ONGOING → FINALIZED`) with an explicit start action.

No new modules. No new files. No RBAC changes. All changes are extensions to the existing `visit` module.

---

## Domain Changes

### `VisitStatus` — third state

```prisma
enum VisitStatus {
  NOT_STARTED
  ONGOING
  FINALIZED
}
```

`NOT_STARTED`: visit created by backoffice, inspector not yet started.
`ONGOING`: inspector started via explicit action.
`FINALIZED`: inspector finalized.

**Migration:** `ALTER TYPE "VisitStatus" ADD VALUE 'NOT_STARTED'` — no USING clause, no UPDATE on existing rows. Existing ONGOING rows remain ONGOING.

### Concurrency invariant

At most one visit with status `NOT_STARTED` or `ONGOING` per checklist at any time. Enforced in `createVisit`: guard updated from `ONGOING` → `NOT_STARTED | ONGOING`.

---

## API Changes

### New: `GET /visits/mine`

```
GET /visits/mine?status=NOT_STARTED
Authorization: Bearer <token>
Permission: visits:read
```

Returns visits where `inspectorId = request.user.sub`. Optional `?status` filter accepts `NOT_STARTED`, `ONGOING`, or `FINALIZED`. Without filter, returns all. Empty array `[]` when no visits match.

**Response `200`:**

```json
[
  {
    "id": 7,
    "status": "NOT_STARTED",
    "createdAt": "2026-06-01T10:00:00Z",
    "apartment": {
      "identifier": "101",
      "floor": 1,
      "block": "A",
      "building": { "name": "Residencial Aurora" }
    }
  }
]
```

### New: `PATCH /visits/:id/start`

```
PATCH /visits/:id/start
Authorization: Bearer <token>
Permission: visits:update
```

Transitions visit from `NOT_STARTED → ONGOING`. No request body.

**Error cases:**

| Situation | Code | Message |
|---|---|---|
| Visit not found | 404 | "Visit not found." |
| Status is ONGOING or FINALIZED | 409 | "Visit has already been started or finalized." |

**Response `200`:** visit summary (id, status, createdAt, apartment context).

### Updated: `GET /visits/:id`

Same shape as Spec 6 (`rooms[]`), extended with `apartment` context:

```json
{
  "id": 7,
  "checklistId": 3,
  "status": "ONGOING",
  "observations": null,
  "finalizedAt": null,
  "createdAt": "...",
  "inspector": { "id": 2, "name": "João" },
  "apartment": {
    "identifier": "101",
    "floor": 1,
    "block": "A",
    "building": { "name": "Residencial Aurora" }
  },
  "rooms": [ ... ]
}
```

### Updated: `PATCH /visits/:id` (finalize)

Additional guard: `400` if status is `NOT_STARTED` — "Visit has not been started yet."
Existing guards (null items, NOK without NC, already finalized) unchanged.

### Updated: `POST /checklists/:id/visits` (createVisit)

- New visits created with `status: NOT_STARTED` instead of default `ONGOING`
- Concurrency guard updated: blocks if any visit has status `NOT_STARTED` or `ONGOING`

---

## Business Logic

### `getMyVisits(inspectorId, status?)` — service

Reads `inspectorId` from JWT `sub`. Queries visits filtered by `inspectorId` and optionally by `status`. Returns visits with apartment + building context.

### `startVisit(visitId)` — service

1. `findById(visitId)` — 404 if not found
2. Guard: if `status !== NOT_STARTED` → 409
3. `repo.updateStatus(visitId, ONGOING)`
4. Return updated visit summary

### Repository: `findByInspectorId(inspectorId, status?)`

Include chain for apartment context:

```ts
checklist: {
  include: {
    apartment: {
      include: {
        building: { select: { name: true } }
      }
    }
  }
}
```

### Repository: `findById` — extended include

Add apartment context to the existing deep include:

```ts
checklist: {
  include: {
    apartment: {
      select: {
        identifier: true,
        floor: true,
        block: true,
        building: { select: { name: true } }
      }
    }
  }
}
```

---

## Files to Change

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `NOT_STARTED` to `VisitStatus` enum |
| `prisma/migrations/<ts>_visit_not_started/` | `ADD VALUE 'NOT_STARTED'` |
| `visit.routes.ts` | Register `GET /mine` (before `/:id`) and `PATCH /:id/start` |
| `visit.repository.ts` | `findByInspectorId(id, status?)` + apartment include in `findById` |
| `visit.service.ts` | `getMyVisits`, `startVisit`; update `createVisit` guard; add `NOT_STARTED` guard in `finalizeVisit` |
| `visit.controller.ts` | `listMine`, `start`; include `apartment` in `getOne` response |
| `visit.schema.ts` | `NOT_STARTED` in `VisitStatus`; response schemas extended with `apartment` |

---

## Error Handling Summary

| Situation | Code | Message |
|---|---|---|
| Start already ONGOING/FINALIZED | 409 | "Visit has already been started or finalized." |
| Finalize NOT_STARTED | 400 | "Visit has not been started yet." |
| Create visit when NOT_STARTED or ONGOING exists | 409 | "A visit is already in progress for this checklist." |
| Visit not found | 404 | "Visit not found." |

All existing error cases from Specs 3 and 6 remain unchanged.

---

## Out of Scope (Spec 7)

- Building-level visit grouping (inspector sees all apartments in a building in one session)
- Push notifications for new visit assignment
- JWT refresh tokens (current TTL: 1 day)
- Offline support
- Inspector role seed (created manually by Administrator via backoffice)

---

## Post-Deploy Configuration

After deploying Spec 7, the Administrator must create the Inspector role manually via the backoffice. See vault: `Docs/Next-Steps/2026-06-02-inspector-role-setup.md`.

---

## Related

- [[2026-06-02-spec6-room-centric-visit-implementation]] — room-centric flow, EvaluationStatus
- [[2026-05-26-spec3-inspection-implementation]] — Visit, VisitItem, ChecklistItem base
- [[2026-05-19-rbac-roles]] — permission catalog
