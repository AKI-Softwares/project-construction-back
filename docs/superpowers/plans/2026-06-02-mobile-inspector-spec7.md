# Mobile Inspector Support (Spec 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visit discovery (`GET /visits/mine`), an explicit start action (`PATCH /visits/:id/start`), and apartment/building context to visit responses so the mobile inspector app can function end-to-end.

**Architecture:** All changes live inside the existing `visit` module plus one guard update in `checklist.service.ts`. A new `NOT_STARTED` enum value introduces a three-state lifecycle (`NOT_STARTED → ONGOING → FINALIZED`). New repository methods (`findByInspectorId`, `updateStatus`) and two new routes are added. No new modules, no new files, no RBAC changes.

**Tech Stack:** Prisma v6, PostgreSQL (Neon), Fastify v5, Zod v4, TypeScript ESM

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | `NOT_STARTED` in `VisitStatus`; `Visit.status @default(NOT_STARTED)` |
| `prisma/migrations/<ts>_visit_not_started/` | Create (auto) | `ALTER TYPE "VisitStatus" ADD VALUE 'NOT_STARTED'` |
| `src/modules/visit/visit.schema.ts` | Modify | Add `visitMineQuerySchema`, `VisitMineQuery` type |
| `src/modules/visit/visit.repository.ts` | Modify | Add `VISIT_MINE_SELECT`, `findByInspectorId`, `updateStatus`; extend `VISIT_DETAIL_SELECT` with `checklist.apartment` |
| `src/modules/visit/visit.service.ts` | Modify | Add `getMyVisits`, `startVisit`; update `getVisitGrouped`; add `NOT_STARTED` guards in `finalizeVisit`, `updateVisitItem`, `addNonConformity` |
| `src/modules/visit/visit.controller.ts` | Modify | Add `listMine`, `start` handlers |
| `src/modules/visit/visit.routes.ts` | Modify | Register `GET /mine` and `PATCH /:id/start` |
| `src/modules/checklist/checklist.repository.ts` | Modify | `createVisitWithItems`: change `status: "ONGOING"` → `"NOT_STARTED"` |
| `src/modules/checklist/checklist.service.ts` | Modify | `createVisit` guard: block `NOT_STARTED` in addition to `ONGOING` |
| `insomnia-collection.json` | Modify | Add "My Visits" and "Start Visit" requests |

---

## Task 1: Schema — Add `NOT_STARTED` to `VisitStatus`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `VisitStatus` enum and `Visit` model default**

In `prisma/schema.prisma`, replace:

```prisma
enum VisitStatus {
  ONGOING
  FINALIZED
}
```

With:

```prisma
enum VisitStatus {
  NOT_STARTED
  ONGOING
  FINALIZED
}
```

In the `Visit` model, change the `status` field default:

```prisma
// before:
status  VisitStatus @default(ONGOING)

// after:
status  VisitStatus @default(NOT_STARTED)
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted for a name, enter: `visit_not_started`

Expected: Prisma generates and applies the migration. The generated SQL should contain:

```sql
ALTER TYPE "VisitStatus" ADD VALUE 'NOT_STARTED';
```

If Prisma wraps this in `BEGIN`/`COMMIT`, PostgreSQL will reject it — `ADD VALUE` is not transactional. In that case, hand-edit the generated migration file to remove the `BEGIN`/`COMMIT` wrapping, then run `npm run db:deploy` to apply the edited file.

- [ ] **Step 3: Verify Prisma client regenerated**

Check `generated/prisma/client.js` (or `index.d.ts`) contains `NOT_STARTED` in the `VisitStatus` enum. If not, run:

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add NOT_STARTED to VisitStatus, update Visit default"
```

---

## Task 2: `visit.schema.ts` — Query schema for `/mine`

**Files:**
- Modify: `src/modules/visit/visit.schema.ts`

- [ ] **Step 1: Add query schema and export type**

Append to `src/modules/visit/visit.schema.ts`:

```ts
export const visitMineQuerySchema = z.object({
  status: z.enum(["NOT_STARTED", "ONGOING", "FINALIZED"]).optional(),
});

export type VisitMineQuery = z.infer<typeof visitMineQuerySchema>;
```

Final file content:

```ts
import { z } from "zod";

export const visitParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const visitItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export const visitMineQuerySchema = z.object({
  status: z.enum(["NOT_STARTED", "ONGOING", "FINALIZED"]).optional(),
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
export type VisitMineQuery = z.infer<typeof visitMineQuerySchema>;
export type FinalizeVisitInput = z.infer<typeof finalizeVisitSchema>;
export type UpdateVisitItemInput = z.infer<typeof updateVisitItemSchema>;
export type AddNonConformityInput = z.infer<typeof addNonConformitySchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/visit/visit.schema.ts
git commit -m "feat(visit): add visitMineQuerySchema for GET /visits/mine"
```

---

## Task 3: `visit.repository.ts` — New selects and methods

**Files:**
- Modify: `src/modules/visit/visit.repository.ts`

- [ ] **Step 1: Add `VISIT_MINE_SELECT` and extend `VISIT_DETAIL_SELECT`**

Replace the top of `visit.repository.ts` (the const declarations) with the following. The existing `VISIT_DETAIL_SELECT` gains a `checklist` field for apartment context:

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { FinalizeVisitInput } from "./visit.schema.js";

const VISIT_MINE_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  checklist: {
    select: {
      apartment: {
        select: {
          identifier: true,
          floor: true,
          block: true,
          building: { select: { name: true } },
        },
      },
    },
  },
} as const;

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
  checklist: {
    select: {
      apartment: {
        select: {
          identifier: true,
          floor: true,
          block: true,
          building: { select: { name: true } },
        },
      },
    },
  },
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
```

- [ ] **Step 2: Add `findByInspectorId` and `updateStatus` methods to `VisitRepository`**

Append inside the `VisitRepository` class, after the existing `deleteNonConformity` method:

```ts
async findByInspectorId(inspectorId: number, status?: "NOT_STARTED" | "ONGOING" | "FINALIZED") {
  return prisma.visit.findMany({
    where: {
      inspectorId,
      ...(status !== undefined && { status }),
    },
    select: VISIT_MINE_SELECT,
    orderBy: { createdAt: "desc" as const },
  });
}

async updateStatus(visitId: number, status: "ONGOING") {
  return prisma.visit.update({
    where: { id: visitId },
    data: { status },
    select: VISIT_MINE_SELECT,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.repository.ts
git commit -m "feat(visit): add findByInspectorId, updateStatus; add apartment context to VISIT_DETAIL_SELECT"
```

---

## Task 4: `visit.service.ts` — New methods and updated guards

**Files:**
- Modify: `src/modules/visit/visit.service.ts`

- [ ] **Step 1: Update imports**

Add `VisitMineQuery` to the import:

```ts
import type {
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
  VisitMineQuery,
} from "./visit.schema.js";
```

- [ ] **Step 2: Update `getVisitGrouped` to extract `apartment` from `checklist`**

Replace the current `getVisitGrouped` method:

```ts
async getVisitGrouped(id: number) {
  const visit = await this.repo.findById(id);
  if (!visit) throw new HttpError(404, "Visit not found.");
  const { items, checklist, ...rest } = visit;
  return { ...rest, apartment: checklist.apartment, rooms: groupByRoom(items) };
}
```

- [ ] **Step 3: Add `getMyVisits` and `startVisit` methods**

Add after `getVisitGrouped`:

```ts
async getMyVisits(inspectorId: number, status?: VisitMineQuery["status"]) {
  const visits = await this.repo.findByInspectorId(inspectorId, status);
  return visits.map(({ checklist, ...rest }) => ({
    ...rest,
    apartment: checklist.apartment,
  }));
}

async startVisit(visitId: number) {
  const visit = await this.repo.findById(visitId);
  if (!visit) throw new HttpError(404, "Visit not found.");
  if (visit.status !== "NOT_STARTED") {
    throw new HttpError(409, "Visit has already been started or finalized.");
  }
  const updated = await this.repo.updateStatus(visitId, "ONGOING");
  const { checklist, ...rest } = updated;
  return { ...rest, apartment: checklist.apartment };
}
```

- [ ] **Step 4: Add `NOT_STARTED` guard to `finalizeVisit`**

In `finalizeVisit`, add after the existing `FINALIZED` guard:

```ts
if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");
if (visit.status === "NOT_STARTED") throw new HttpError(400, "Visit has not been started yet.");
```

- [ ] **Step 5: Add `NOT_STARTED` guard to `updateVisitItem`**

In `updateVisitItem`, update the status guards block:

```ts
if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");
if (visit.status === "NOT_STARTED") throw new HttpError(400, "Visit has not been started yet.");
```

- [ ] **Step 6: Add `NOT_STARTED` guard to `addNonConformity`**

In `addNonConformity`, update the status guards block:

```ts
if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");
if (visit.status === "NOT_STARTED") throw new HttpError(400, "Visit has not been started yet.");
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/visit/visit.service.ts
git commit -m "feat(visit): add getMyVisits, startVisit; add NOT_STARTED guards"
```

---

## Task 5: `visit.controller.ts` — New handlers

**Files:**
- Modify: `src/modules/visit/visit.controller.ts`

- [ ] **Step 1: Add `VisitMineQuery` to imports**

```ts
import type {
  VisitParams,
  VisitItemParams,
  VisitMineQuery,
  FinalizeVisitInput,
  UpdateVisitItemInput,
  AddNonConformityInput,
} from "./visit.schema.js";
```

- [ ] **Step 2: Add `listMine` and `start` handlers**

Add inside `VisitController`, after the existing `getOne` method:

```ts
async listMine(
  request: FastifyRequest<{ Querystring: VisitMineQuery }>,
  reply: FastifyReply,
) {
  const inspectorId = Number(request.user.sub);
  const visits = await this.service.getMyVisits(inspectorId, request.query.status);
  return reply.status(200).send(visits);
}

async start(
  request: FastifyRequest<{ Params: VisitParams }>,
  reply: FastifyReply,
) {
  const visit = await this.service.startVisit(request.params.id);
  return reply.status(200).send(visit);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/visit/visit.controller.ts
git commit -m "feat(visit): add listMine and start controller handlers"
```

---

## Task 6: `visit.routes.ts` — Register new routes

**Files:**
- Modify: `src/modules/visit/visit.routes.ts`

- [ ] **Step 1: Add imports and register routes**

Replace the full file with:

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { VisitRepository } from "./visit.repository.js";
import { VisitService } from "./visit.service.js";
import { VisitController } from "./visit.controller.js";
import {
  visitParamsSchema,
  visitItemParamsSchema,
  visitMineQuerySchema,
  finalizeVisitSchema,
  updateVisitItemSchema,
  addNonConformitySchema,
} from "./visit.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const visitRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new VisitRepository();
  const service = new VisitService(repo);
  const controller = new VisitController(service);

  // GET /mine must be registered before GET /:id to prevent Fastify
  // from capturing "mine" as an :id parameter value.
  app.get(
    "/mine",
    {
      schema: { querystring: visitMineQuerySchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.listMine.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.getOne.bind(controller),
  );

  app.patch(
    "/:id/start",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.start.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: visitParamsSchema, body: finalizeVisitSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.finalize.bind(controller),
  );

  app.patch(
    "/:id/items/:itemId",
    {
      schema: { params: visitItemParamsSchema, body: updateVisitItemSchema },
      preHandler: [app.authenticate, checkPermission("visits:update")],
    },
    controller.updateItem.bind(controller),
  );

  app.post(
    "/:id/items/:itemId/non-conformities",
    {
      schema: { params: visitItemParamsSchema, body: addNonConformitySchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:create")],
    },
    controller.addNonConformity.bind(controller),
  );

  app.delete(
    "/:id/items/:itemId/non-conformities",
    {
      schema: { params: visitItemParamsSchema },
      preHandler: [app.authenticate, checkPermission("non-conformities:delete")],
    },
    controller.deleteNonConformity.bind(controller),
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/visit/visit.routes.ts
git commit -m "feat(visit): register GET /mine and PATCH /:id/start routes"
```

---

## Task 7: `checklist.repository.ts` + `checklist.service.ts` — Update createVisit

**Files:**
- Modify: `src/modules/checklist/checklist.repository.ts`
- Modify: `src/modules/checklist/checklist.service.ts`

- [ ] **Step 1: Change `createVisitWithItems` to use `NOT_STARTED`**

In `src/modules/checklist/checklist.repository.ts`, inside `createVisitWithItems`, change:

```ts
// before:
const visit = await tx.visit.create({
  data: { checklistId, inspectorId, createdById, status: "ONGOING" },
  select: { id: true },
});

// after:
const visit = await tx.visit.create({
  data: { checklistId, inspectorId, createdById, status: "NOT_STARTED" },
  select: { id: true },
});
```

- [ ] **Step 2: Update `createVisit` guard in `checklist.service.ts`**

In `src/modules/checklist/checklist.service.ts`, replace:

```ts
const ongoingVisit = checklist.visits.find((v) => v.status === "ONGOING");
if (ongoingVisit) {
  throw new HttpError(409, "A visit is already in progress for this checklist.");
}
```

With:

```ts
const activeVisit = checklist.visits.find(
  (v) => v.status === "NOT_STARTED" || v.status === "ONGOING",
);
if (activeVisit) {
  throw new HttpError(409, "A visit is already in progress for this checklist.");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/checklist/checklist.repository.ts src/modules/checklist/checklist.service.ts
git commit -m "fix(checklist): create visits as NOT_STARTED, block duplicate active visits"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server starts on port 3333 with no TypeScript errors.

- [ ] **Step 2: Verify `GET /visits/mine` — empty list**

Login as an inspector user. Then:

```
GET http://localhost:3333/visits/mine
Authorization: Bearer <inspector-token>
```

Expected `200 []` (empty array if no visits assigned).

- [ ] **Step 3: Create a visit via backoffice and verify it appears as `NOT_STARTED`**

Login as Administrator. Create a visit:

```
POST http://localhost:3333/checklists/:checklistId/visits
Body: { "inspectorId": <inspector-user-id> }
```

Expected `201` with `"status": "NOT_STARTED"`.

Then as inspector:

```
GET http://localhost:3333/visits/mine?status=NOT_STARTED
```

Expected `200` with the visit in the array, including `apartment.identifier`, `apartment.floor`, `apartment.block`, `apartment.building.name`.

- [ ] **Step 4: Verify `PATCH /visits/:id/start`**

```
PATCH http://localhost:3333/visits/:id/start
Authorization: Bearer <inspector-token>
```

Expected `200` with `"status": "ONGOING"` and `apartment` context.

Calling start again on the same visit: expected `409 "Visit has already been started or finalized."`.

- [ ] **Step 5: Verify `GET /visits/:id` includes apartment context**

```
GET http://localhost:3333/visits/:id
Authorization: Bearer <inspector-token>
```

Expected `200` with `apartment.identifier`, `apartment.floor`, `apartment.block`, `apartment.building.name` at the top level alongside `rooms[]`.

- [ ] **Step 6: Verify `NOT_STARTED` blocks evaluation**

Try evaluating an item on a `NOT_STARTED` visit (create a new one, do not start it):

```
PATCH http://localhost:3333/visits/:id/items/:itemId
Body: { "status": "OK" }
```

Expected `400 "Visit has not been started yet."`.

- [ ] **Step 7: Verify finalize guard**

Try finalizing a `NOT_STARTED` visit:

```
PATCH http://localhost:3333/visits/:id
Body: { "status": "FINALIZED" }
```

Expected `400 "Visit has not been started yet."`.

- [ ] **Step 8: Verify duplicate active visit guard**

With an existing `NOT_STARTED` or `ONGOING` visit on a checklist, try creating another:

```
POST http://localhost:3333/checklists/:checklistId/visits
Body: { "inspectorId": <id> }
```

Expected `409 "A visit is already in progress for this checklist."`.

---

## Task 9: Insomnia collection

**Files:**
- Modify: `insomnia-collection.json`

- [ ] **Step 1: Add "My Visits" request to the Visits folder**

Open Insomnia, go to the Visits folder, add a new GET request:

- Name: `My Visits`
- URL: `{{ base_url }}/visits/mine`
- Query param: `status` = `NOT_STARTED` (optional — add as a disabled param so it can be toggled)
- Auth: Bearer `{{ auth_token }}`

- [ ] **Step 2: Add "Start Visit" request**

Add a new PATCH request in the Visits folder:

- Name: `Start Visit`
- URL: `{{ base_url }}/visits/:id/start`
- No body
- Auth: Bearer `{{ auth_token }}`

- [ ] **Step 3: Export and commit**

Export the updated collection from Insomnia and replace `insomnia-collection.json`.

```bash
git add insomnia-collection.json
git commit -m "chore(insomnia): add My Visits and Start Visit requests for Spec 7"
```
