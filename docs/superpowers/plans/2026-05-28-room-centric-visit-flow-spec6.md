# Room-Centric Visit Flow (Spec 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce room-by-room inspection discipline — guard room switching until current room is complete, guard next-item evaluation until all NOK items in current room have a NonConformity, and return `GET /visits/:id` response grouped by room.

**Architecture:** All changes are behavioral on existing endpoints — no new routes, no new modules. A new `EvaluationStatus` enum replaces `ChecklistItemStatus` on `VisitItem.status` (nullable; null = not yet evaluated). Two guards added to `updateVisitItem` in the service layer. Controller maps flat `items[]` to `rooms[]` before responding.

**Tech Stack:** Prisma v6, PostgreSQL (Neon), Fastify v5, Zod v4, TypeScript ESM

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `EvaluationStatus` enum; `VisitItem.status` → `EvaluationStatus?` |
| `prisma/migrations/<ts>_evaluation_status/` | Create (auto) | SQL migration for new enum + column change |
| `src/modules/visit/visit.schema.ts` | Modify | Remove `PENDING` from `updateVisitItemSchema`; update `UpdateVisitItemInput` |
| `src/modules/visit/visit.repository.ts` | Modify | Update type signatures on `applyFinalization` and `updateVisitItemWithNcCleanup` |
| `src/modules/visit/visit.service.ts` | Modify | Add Guard 1, Guard 2; update finalization null check; remove PENDING from NC cleanup |
| `src/modules/visit/visit.controller.ts` | Modify | Add `groupByRoom` mapper; update `getOne` to use it |

---

## Task 1: Schema — Add `EvaluationStatus`, make `VisitItem.status` nullable

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `EvaluationStatus` enum and update `VisitItem` model**

In `prisma/schema.prisma`, add the new enum after the existing enums and update `VisitItem`:

```prisma
enum EvaluationStatus {
  OK
  NOK
}
```

Replace the `VisitItem` model's `status` field:

```prisma
model VisitItem {
  id              Int               @id @default(autoincrement())
  visitId         Int               @map("visit_id")
  checklistItemId Int               @map("checklist_item_id")
  status          EvaluationStatus?
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

`ChecklistItemStatus` keeps `PENDING` — only `VisitItem` changes.

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted for migration name, enter: `evaluation_status`

Expected: Prisma generates and applies migration. No errors. The migration SQL will contain:

```sql
CREATE TYPE "EvaluationStatus" AS ENUM ('OK', 'NOK');
ALTER TABLE "VisitItem" ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EvaluationStatus"
    USING CASE WHEN "status" = 'PENDING' THEN NULL
               ELSE "status"::text::"EvaluationStatus" END,
  ALTER COLUMN "status" DROP NOT NULL;
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: No errors. `generated/prisma` updated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add EvaluationStatus enum, make VisitItem.status nullable"
```

---

## Task 2: Schema validation — Remove PENDING from `updateVisitItemSchema`

**Files:**
- Modify: `src/modules/visit/visit.schema.ts`

- [ ] **Step 1: Update `updateVisitItemSchema`**

Replace the full file content:

```ts
import { z } from "zod";

export const visitParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const visitItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export const finalizeVisitSchema = z.object({
  status: z.literal("FINALIZED"),
  observations: z.string().min(1).optional(),
});

export const updateVisitItemSchema = z.object({
  status: z.enum(["OK", "NOK"]),
});

export const addNonConformitySchema = z.object({
  description: z.string().min(1),
});

export type VisitParams = z.infer<typeof visitParamsSchema>;
export type VisitItemParams = z.infer<typeof visitItemParamsSchema>;
export type FinalizeVisitInput = z.infer<typeof finalizeVisitSchema>;
export type UpdateVisitItemInput = z.infer<typeof updateVisitItemSchema>;
export type AddNonConformityInput = z.infer<typeof addNonConformitySchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: errors only in `visit.repository.ts` and `visit.service.ts` where old `"PENDING"` references exist. Those get fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.schema.ts
git commit -m "feat(visit): remove PENDING from updateVisitItemSchema"
```

---

## Task 3: Repository — Update type signatures

**Files:**
- Modify: `src/modules/visit/visit.repository.ts`

> Note: `VISIT_DETAIL_SELECT` already fetches `apartmentRoom` and `service` inside items — no select changes needed. Only type signatures on method parameters change.

- [ ] **Step 1: Update `applyFinalization` and `updateVisitItemWithNcCleanup` signatures**

Replace the full file content:

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { FinalizeVisitInput } from "./visit.schema.js";

const VISIT_DETAIL_SELECT = {
  id: true,
  checklistId: true,
  observations: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  inspector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      status: true,
      checklistItemId: true,
      checklistItem: {
        select: {
          id: true,
          apartmentRoomService: {
            select: {
              id: true,
              service: { select: { id: true, name: true, category: true } },
              apartmentRoom: { select: { id: true, name: true } },
            },
          },
        },
      },
      nonConformity: {
        select: {
          id: true,
          description: true,
          createdAt: true,
          photos: { select: { id: true, url: true, uploadedAt: true } },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

export class VisitRepository {
  async findById(id: number) {
    return prisma.visit.findUnique({ where: { id }, select: VISIT_DETAIL_SELECT });
  }

  async applyFinalization(
    visitId: number,
    checklistId: number,
    items: Array<{ checklistItemId: number; status: "OK" | "NOK" }>,
    input: FinalizeVisitInput,
    finalizedById: number,
  ) {
    return prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.checklistItem.update({
          where: { id: item.checklistItemId },
          data: { status: item.status },
        });
      }

      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: "FINALIZED",
          finalizedAt: new Date(),
          ...(input.observations !== undefined && { observations: input.observations }),
        },
      });

      const notOkCount = await tx.checklistItem.count({
        where: { checklistId, status: { not: "OK" } },
      });

      if (notOkCount === 0) {
        await tx.checklist.update({
          where: { id: checklistId },
          data: { status: "FINALIZED", finalizedById, finalizedAt: new Date() },
        });
      }

      return tx.visit.findUnique({ where: { id: visitId }, select: VISIT_DETAIL_SELECT });
    });
  }

  async updateVisitItemWithNcCleanup(
    itemId: number,
    newStatus: "OK" | "NOK",
    currentStatus: "OK" | "NOK" | null,
    ncId: number | null,
  ) {
    if (currentStatus === "NOK" && newStatus !== "NOK" && ncId !== null) {
      return prisma.$transaction(async (tx) => {
        await tx.nonConformity.delete({ where: { id: ncId } });
        return tx.visitItem.update({
          where: { id: itemId },
          data: { status: newStatus },
          select: { id: true, status: true, visitId: true, checklistItemId: true },
        });
      });
    }
    return prisma.visitItem.update({
      where: { id: itemId },
      data: { status: newStatus },
      select: { id: true, status: true, visitId: true, checklistItemId: true },
    });
  }

  async createNonConformity(visitItemId: number, description: string) {
    return prisma.nonConformity.create({
      data: { visitItemId, description },
      select: {
        id: true,
        description: true,
        createdAt: true,
        photos: { select: { id: true, url: true, uploadedAt: true } },
      },
    });
  }

  async deleteNonConformity(ncId: number) {
    return prisma.nonConformity.delete({ where: { id: ncId }, select: { id: true } });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: errors only in `visit.service.ts` (PENDING references). Repository should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.repository.ts
git commit -m "fix(visit): update repository type signatures for EvaluationStatus"
```

---

## Task 4: Service — Guards + null check

**Files:**
- Modify: `src/modules/visit/visit.service.ts`

- [ ] **Step 1: Rewrite `visit.service.ts` with both guards and updated finalization**

Replace the full file content:

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { VisitRepository } from "./visit.repository.js";
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

export class VisitService {
  constructor(private repo: VisitRepository) {}

  async getVisit(id: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    return visit;
  }

  async finalizeVisit(id: number, input: FinalizeVisitInput, userId: number) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const unevaluatedItems = visit.items.filter((i) => i.status === null);
    if (unevaluatedItems.length > 0) {
      throw new HttpError(400, "All items must be evaluated before finalizing.");
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(400, "All NOK items must have a non-conformity recorded.");
    }

    const evaluatedItems = visit.items.map((i) => ({
      checklistItemId: i.checklistItemId,
      status: i.status as "OK" | "NOK",
    }));

    const result = await this.repo.applyFinalization(visit.id, visit.checklistId, evaluatedItems, input, userId);
    if (!result) throw new Error("Visit not found after finalization.");
    return result;
  }

  async updateVisitItem(visitId: number, itemId: number, input: UpdateVisitItemInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");

    const targetRoomId = item.checklistItem.apartmentRoomService.apartmentRoom.id;

    // Build room map: roomId → items
    const roomMap = new Map<number, typeof visit.items>();
    for (const vi of visit.items) {
      const roomId = vi.checklistItem.apartmentRoomService.apartmentRoom.id;
      if (!roomMap.has(roomId)) roomMap.set(roomId, []);
      roomMap.get(roomId)!.push(vi);
    }

    // Guard 1: block switching to a different room while another room is in progress
    for (const [roomId, roomItems] of roomMap) {
      if (roomId === targetRoomId) continue;
      const hasEvaluated = roomItems.some((i) => i.status !== null);
      const hasUnevaluated = roomItems.some((i) => i.status === null);
      if (hasEvaluated && hasUnevaluated) {
        throw new HttpError(409, "Finish current room before switching.");
      }
    }

    // Guard 2: block evaluating next item while current room has NOK items without NC
    const roomItems = roomMap.get(targetRoomId) ?? [];
    const nokWithoutNc = roomItems.filter(
      (i) => i.id !== itemId && i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(409, "Record non-conformity for all NOK items before proceeding.");
    }

    return this.repo.updateVisitItemWithNcCleanup(
      itemId,
      input.status,
      item.status,
      item.nonConformity?.id ?? null,
    );
  }

  async addNonConformity(visitId: number, itemId: number, input: AddNonConformityInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (item.status !== "NOK") {
      throw new HttpError(409, "Non-conformity can only be added to NOK items.");
    }
    if (item.nonConformity) {
      throw new HttpError(409, "This item already has a non-conformity.");
    }

    return this.repo.createNonConformity(itemId, input.description);
  }

  async deleteNonConformity(visitId: number, itemId: number) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");
    if (!item.nonConformity) throw new HttpError(404, "No non-conformity found for this item.");

    return this.repo.deleteNonConformity(item.nonConformity.id);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.service.ts
git commit -m "feat(visit): add room-switch guard and NOK-without-NC guard"
```

---

## Task 5: Controller — Room-grouped response

**Files:**
- Modify: `src/modules/visit/visit.controller.ts`

- [ ] **Step 1: Add `groupByRoom` and update `getOne`**

Replace the full file content:

```ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { VisitService } from "./visit.service.js";
import type {
  VisitParams,
  VisitItemParams,
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";

type VisitDetail = NonNullable<Awaited<ReturnType<VisitService["getVisit"]>>>;
type VisitItemRaw = VisitDetail["items"][number];

function groupByRoom(items: VisitItemRaw[]) {
  const map = new Map<number, {
    id: number;
    name: string;
    isComplete: boolean;
    items: object[];
  }>();

  for (const item of items) {
    const room = item.checklistItem.apartmentRoomService.apartmentRoom;
    if (!map.has(room.id)) {
      map.set(room.id, { id: room.id, name: room.name, isComplete: true, items: [] });
    }
    const group = map.get(room.id)!;
    if (item.status === null) group.isComplete = false;
    group.items.push({
      id: item.id,
      serviceId: item.checklistItem.apartmentRoomService.service.id,
      serviceName: item.checklistItem.apartmentRoomService.service.name,
      status: item.status,
      nonConformity: item.nonConformity
        ? {
            id: item.nonConformity.id,
            description: item.nonConformity.description,
            createdAt: item.nonConformity.createdAt,
            photos: item.nonConformity.photos,
          }
        : null,
    });
  }

  return Array.from(map.values());
}

export class VisitController {
  constructor(private service: VisitService) {}

  async getOne(
    request: FastifyRequest<{ Params: VisitParams }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.getVisit(request.params.id);
    const { items, ...rest } = visit;
    return reply.status(200).send({ ...rest, rooms: groupByRoom(items) });
  }

  async finalize(
    request: FastifyRequest<{ Params: VisitParams; Body: FinalizeVisitInput }>,
    reply: FastifyReply,
  ) {
    const userId = Number(request.user.sub);
    const visit = await this.service.finalizeVisit(request.params.id, request.body, userId);
    return reply.status(200).send(visit);
  }

  async updateItem(
    request: FastifyRequest<{ Params: VisitItemParams; Body: UpdateVisitItemInput }>,
    reply: FastifyReply,
  ) {
    const item = await this.service.updateVisitItem(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(200).send(item);
  }

  async addNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams; Body: AddNonConformityInput }>,
    reply: FastifyReply,
  ) {
    const nc = await this.service.addNonConformity(
      request.params.id,
      request.params.itemId,
      request.body,
    );
    return reply.status(201).send(nc);
  }

  async deleteNonConformity(
    request: FastifyRequest<{ Params: VisitItemParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteNonConformity(request.params.id, request.params.itemId);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.controller.ts
git commit -m "feat(visit): return room-grouped response on GET /visits/:id"
```

---

## Task 6: Manual verification

Start the dev server and verify all scenarios with the Insomnia collection (Local env).

```bash
npm run dev
```

- [ ] **Scenario 1 — GET /visits/:id returns rooms**

Call `GET /visits/:id` on an existing visit.

Expected response shape:
```json
{
  "id": 1,
  "status": "ONGOING",
  "rooms": [
    {
      "id": 5,
      "name": "Sala",
      "isComplete": false,
      "items": [
        { "id": 10, "serviceName": "Pintura", "status": null, "nonConformity": null }
      ]
    }
  ]
}
```

No `items` key at top level. Each room has `isComplete`.

- [ ] **Scenario 2 — Guard 1: block switching rooms mid-inspection**

1. Mark one item in Room A as OK → succeeds (200)
2. Mark one item in Room B (different room) without finishing Room A → expect `409 "Finish current room before switching."`

- [ ] **Scenario 3 — Guard 2: block next item when NOK has no NC**

1. Mark item X in Room A as NOK → succeeds (200)
2. Immediately mark item Y (same room) as OK → expect `409 "Record non-conformity for all NOK items before proceeding."`
3. Add NonConformity to item X → succeeds (201)
4. Mark item Y as OK → succeeds (200)

- [ ] **Scenario 4 — Guard 1: free choice among untouched rooms**

1. Complete all items in Room A
2. Mark one item in Room B → succeeds (200) — Room B was untouched so no block
3. Mark one item in Room C → expect `409 "Finish current room before switching."` (Room B is in progress)

- [ ] **Scenario 5 — Finalize with unevaluated items**

Call `PATCH /visits/:id` with `{ "status": "FINALIZED" }` while some items are still null.

Expected: `400 "All items must be evaluated before finalizing."`

- [ ] **Scenario 6 — Full happy path**

1. Complete all rooms (all items OK or NOK with NC)
2. `PATCH /visits/:id` → `200`, visit status `FINALIZED`
3. Attempt to update any item on finalized visit → `400 "Visit is already finalized."`

- [ ] **Scenario 7 — Sending PENDING as status**

`PATCH /visits/:id/items/:itemId` with `{ "status": "PENDING" }` → expect `422` (Zod validation error)

- [ ] **Commit after verification passes**

```bash
git add .
git commit -m "chore: verify Spec 6 room-centric visit flow"
```

---

## Self-Review Checklist

- [x] **EvaluationStatus enum** → Task 1
- [x] **VisitItem.status nullable** → Task 1
- [x] **Remove PENDING from updateVisitItemSchema** → Task 2
- [x] **Repository type signatures updated** → Task 3
- [x] **Guard 1: room in progress** → Task 4
- [x] **Guard 2: NOK without NC** → Task 4
- [x] **Finalization null check** → Task 4
- [x] **GET /visits/:id room-grouped response** → Task 5
- [x] **isComplete derived field** → Task 5
- [x] **Manual verification scenarios** → Task 6

---

## Related

- `docs/superpowers/specs/2026-05-28-room-centric-visit-flow-spec6-design.md`
