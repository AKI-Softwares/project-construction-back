# Spec 3 — Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Checklist+Visit inspection workflow with auto-creation at apartment instantiation, full visit finalization logic, and NonConformity/Photo tracking.

**Architecture:** Rename dormant `Inspection` Prisma model → `Checklist` (keep `@@map("Inspection")` — no table rename); auto-create Checklist+ChecklistItems inside the existing `POST /apartments` transaction; 3 new modules (checklist, visit, non-conformity) wired into `app.ts`; visit finalization transaction syncs ChecklistItem statuses and auto-finalizes Checklist when all items pass.

**Tech Stack:** Fastify v5, Prisma v6 + PostgreSQL (Neon), Zod v4, TypeScript ESM (`.js` imports)

---

## File Map

### Created
- `prisma/migrations/20260525000001_spec3-inspection/migration.sql`
- `src/modules/checklist/checklist.schema.ts`
- `src/modules/checklist/checklist.repository.ts`
- `src/modules/checklist/checklist.service.ts`
- `src/modules/checklist/checklist.controller.ts`
- `src/modules/checklist/checklist.routes.ts`
- `src/modules/visit/visit.schema.ts`
- `src/modules/visit/visit.repository.ts`
- `src/modules/visit/visit.service.ts`
- `src/modules/visit/visit.controller.ts`
- `src/modules/visit/visit.routes.ts`
- `src/modules/non-conformity/non-conformity.schema.ts`
- `src/modules/non-conformity/non-conformity.repository.ts`
- `src/modules/non-conformity/non-conformity.service.ts`
- `src/modules/non-conformity/non-conformity.controller.ts`
- `src/modules/non-conformity/non-conformity.routes.ts`

### Modified
- `prisma/schema.prisma`
- `src/shared/rbac/permissions.catalog.ts`
- `src/modules/apartment/apartment.repository.ts`
- `src/modules/apartment/apartment.service.ts`
- `src/main/app.ts`
- `insomnia-collection.json`

---

## Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260525000001_spec3-inspection/migration.sql`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Replace the `InspectionStatus` enum and the dormant `Inspection` model. Add new enums, User backlinks, Apartment backlink, ApartmentRoomService backlink, and the five new models.

Remove this block entirely:
```prisma
enum InspectionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Remove the dormant `Inspection` model block entirely:
```prisma
// Dormant until Spec 3 — relations to Service/Checklist removed
model Inspection {
  id           Int              @id @default(autoincrement())
  name         String           @db.VarChar(255)
  status       InspectionStatus @default(PENDING)
  observations String?          @db.Text
  createdAt    DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime         @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("Inspection")
}
```

Add three new enums at the top of the file (after generator/datasource blocks, before `model User`):
```prisma
enum ChecklistStatus {
  PENDING
  FINALIZED
}

enum ChecklistItemStatus {
  PENDING
  OK
  NOK
}

enum VisitStatus {
  ONGOING
  FINALIZED
}
```

In the `User` model, add three backlink fields before `createdAt`:
```prisma
  checklistsFinalized Checklist[] @relation("ChecklistFinalizedBy")
  visitsAsInspector   Visit[]     @relation("VisitInspector")
  visitsCreated       Visit[]     @relation("VisitCreatedBy")
```

In the `Apartment` model, add a backlink before `@@unique`:
```prisma
  checklist     Checklist?
```

In the `ApartmentRoomService` model, add a backlink before `@@unique`:
```prisma
  checklistItems ChecklistItem[]
```

Add all five new models at the end of the file:
```prisma
model Checklist {
  id            Int             @id @default(autoincrement())
  apartmentId   Int             @unique @map("apartment_id")
  title         String?         @db.VarChar(255)
  status        ChecklistStatus @default(PENDING)
  finalizedById Int?            @map("finalized_by_id")
  finalizedAt   DateTime?       @map("finalized_at") @db.Timestamptz
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartment     Apartment       @relation(fields: [apartmentId], references: [id])
  finalizedBy   User?           @relation("ChecklistFinalizedBy", fields: [finalizedById], references: [id])
  items         ChecklistItem[]
  visits        Visit[]

  @@map("Inspection")
}

model ChecklistItem {
  id                     Int                  @id @default(autoincrement())
  checklistId            Int                  @map("checklist_id")
  apartmentRoomServiceId Int                  @map("apartment_room_service_id")
  status                 ChecklistItemStatus  @default(PENDING)
  createdAt              DateTime             @default(now()) @map("created_at") @db.Timestamptz
  updatedAt              DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  checklist              Checklist            @relation(fields: [checklistId], references: [id])
  apartmentRoomService   ApartmentRoomService @relation(fields: [apartmentRoomServiceId], references: [id], onDelete: Restrict)
  visitItems             VisitItem[]

  @@unique([checklistId, apartmentRoomServiceId])
  @@index([checklistId])
  @@map("ChecklistItem")
}

model Visit {
  id           Int         @id @default(autoincrement())
  checklistId  Int         @map("checklist_id")
  inspectorId  Int         @map("inspector_id")
  createdById  Int         @map("created_by_id")
  observations String?     @db.Text
  status       VisitStatus @default(ONGOING)
  finalizedAt  DateTime?   @map("finalized_at") @db.Timestamptz
  createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  checklist    Checklist   @relation(fields: [checklistId], references: [id])
  inspector    User        @relation("VisitInspector", fields: [inspectorId], references: [id])
  createdBy    User        @relation("VisitCreatedBy", fields: [createdById], references: [id])
  items        VisitItem[]

  @@index([checklistId])
  @@index([inspectorId])
  @@map("Visit")
}

model VisitItem {
  id              Int                 @id @default(autoincrement())
  visitId         Int                 @map("visit_id")
  checklistItemId Int                 @map("checklist_item_id")
  status          ChecklistItemStatus @default(PENDING)
  createdAt       DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime            @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  visit           Visit               @relation(fields: [visitId], references: [id], onDelete: Cascade)
  checklistItem   ChecklistItem       @relation(fields: [checklistItemId], references: [id], onDelete: Restrict)
  nonConformity   NonConformity?

  @@unique([visitId, checklistItemId])
  @@index([checklistItemId])
  @@map("VisitItem")
}

model NonConformity {
  id          Int       @id @default(autoincrement())
  visitItemId Int       @unique @map("visit_item_id")
  description String    @db.Text
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  visitItem   VisitItem @relation(fields: [visitItemId], references: [id], onDelete: Cascade)
  photos      Photo[]

  @@map("NonConformity")
}

model Photo {
  id              Int           @id @default(autoincrement())
  nonConformityId Int           @map("non_conformity_id")
  url             String        @db.VarChar(500)
  uploadedAt      DateTime      @default(now()) @map("uploaded_at") @db.Timestamptz
  nonConformity   NonConformity @relation(fields: [nonConformityId], references: [id], onDelete: Cascade)

  @@index([nonConformityId])
  @@map("Photo")
}
```

- [ ] **Step 2: Create migration SQL file**

Create `prisma/migrations/20260525000001_spec3-inspection/migration.sql` with this exact content:

```sql
-- Convert status column to varchar before dropping enum
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE VARCHAR(20);

-- Drop old enum
DROP TYPE "InspectionStatus";

-- Create new enums
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'FINALIZED');
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'OK', 'NOK');
CREATE TYPE "VisitStatus" AS ENUM ('ONGOING', 'FINALIZED');

-- Drop unused columns from Inspection (table is dormant, no data)
ALTER TABLE "Inspection" DROP COLUMN "name";
ALTER TABLE "Inspection" DROP COLUMN "observations";

-- Add new columns to Inspection (Checklist)
ALTER TABLE "Inspection" ADD COLUMN "apartment_id" INTEGER;
ALTER TABLE "Inspection" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "Inspection" ADD COLUMN "finalized_by_id" INTEGER;
ALTER TABLE "Inspection" ADD COLUMN "finalized_at" TIMESTAMPTZ;

-- Cast status to ChecklistStatus (safe: no data)
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE "ChecklistStatus"
  USING 'PENDING'::"ChecklistStatus";
ALTER TABLE "Inspection" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ChecklistStatus";

-- Make apartment_id NOT NULL and add UNIQUE (no data, safe)
ALTER TABLE "Inspection" ALTER COLUMN "apartment_id" SET NOT NULL;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_apartment_id_key" UNIQUE ("apartment_id");

-- FK constraints on Inspection (Checklist)
ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_apartment_id_fkey"
  FOREIGN KEY ("apartment_id") REFERENCES "Apartment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_finalized_by_id_fkey"
  FOREIGN KEY ("finalized_by_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ChecklistItem table
CREATE TABLE "ChecklistItem" (
  "id"                         SERIAL PRIMARY KEY,
  "checklist_id"               INTEGER NOT NULL,
  "apartment_room_service_id"  INTEGER NOT NULL,
  "status"                     "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ChecklistItem_checklist_id_fkey"
    FOREIGN KEY ("checklist_id") REFERENCES "Inspection"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChecklistItem_apartment_room_service_id_fkey"
    FOREIGN KEY ("apartment_room_service_id") REFERENCES "ApartmentRoomService"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChecklistItem_checklist_id_apartment_room_service_id_key"
    UNIQUE ("checklist_id", "apartment_room_service_id")
);
CREATE INDEX "ChecklistItem_checklist_id_idx" ON "ChecklistItem"("checklist_id");

-- Visit table
CREATE TABLE "Visit" (
  "id"             SERIAL PRIMARY KEY,
  "checklist_id"   INTEGER NOT NULL,
  "inspector_id"   INTEGER NOT NULL,
  "created_by_id"  INTEGER NOT NULL,
  "observations"   TEXT,
  "status"         "VisitStatus" NOT NULL DEFAULT 'ONGOING',
  "finalized_at"   TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Visit_checklist_id_fkey"
    FOREIGN KEY ("checklist_id") REFERENCES "Inspection"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Visit_inspector_id_fkey"
    FOREIGN KEY ("inspector_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Visit_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Visit_checklist_id_idx" ON "Visit"("checklist_id");
CREATE INDEX "Visit_inspector_id_idx" ON "Visit"("inspector_id");

-- VisitItem table
CREATE TABLE "VisitItem" (
  "id"                SERIAL PRIMARY KEY,
  "visit_id"          INTEGER NOT NULL,
  "checklist_item_id" INTEGER NOT NULL,
  "status"            "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "VisitItem_visit_id_fkey"
    FOREIGN KEY ("visit_id") REFERENCES "Visit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VisitItem_checklist_item_id_fkey"
    FOREIGN KEY ("checklist_item_id") REFERENCES "ChecklistItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VisitItem_visit_id_checklist_item_id_key"
    UNIQUE ("visit_id", "checklist_item_id")
);
CREATE INDEX "VisitItem_checklist_item_id_idx" ON "VisitItem"("checklist_item_id");

-- NonConformity table
CREATE TABLE "NonConformity" (
  "id"            SERIAL PRIMARY KEY,
  "visit_item_id" INTEGER NOT NULL,
  "description"   TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "NonConformity_visit_item_id_key" UNIQUE ("visit_item_id"),
  CONSTRAINT "NonConformity_visit_item_id_fkey"
    FOREIGN KEY ("visit_item_id") REFERENCES "VisitItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Photo table
CREATE TABLE "Photo" (
  "id"                SERIAL PRIMARY KEY,
  "non_conformity_id" INTEGER NOT NULL,
  "url"               VARCHAR(500) NOT NULL,
  "uploaded_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Photo_non_conformity_id_fkey"
    FOREIGN KEY ("non_conformity_id") REFERENCES "NonConformity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Photo_non_conformity_id_idx" ON "Photo"("non_conformity_id");
```

- [ ] **Step 3: Apply migration and regenerate client**

```bash
npm run db:deploy
npx prisma generate
```

Expected: migration applied, Prisma client regenerated with `prisma.checklist`, `prisma.checklistItem`, `prisma.visit`, `prisma.visitItem`, `prisma.nonConformity`, `prisma.photo`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors. If schema references are broken, the Prisma generate output in `generated/prisma` should have all new models.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260525000001_spec3-inspection/migration.sql
git commit -m "feat(schema): add Checklist/Visit/NonConformity/Photo models for Spec 3"
```

---

## Task 2: RBAC Permissions Update

**Files:**
- Modify: `src/shared/rbac/permissions.catalog.ts`

- [ ] **Step 1: Replace `inspections:*` entries with Spec 3 permissions**

In `src/shared/rbac/permissions.catalog.ts`, remove the four `inspections:*` lines:
```ts
  { action: "inspections:read",    resource: "inspections",    operation: "read"   },
  { action: "inspections:create",  resource: "inspections",    operation: "create" },
  { action: "inspections:update",  resource: "inspections",    operation: "update" },
  { action: "inspections:delete",  resource: "inspections",    operation: "delete" },
```

Replace with ten new entries:
```ts
  { action: "checklists:read",           resource: "checklists",        operation: "read"   },
  { action: "checklists:update",         resource: "checklists",        operation: "update" },

  { action: "visits:read",               resource: "visits",            operation: "read"   },
  { action: "visits:create",             resource: "visits",            operation: "create" },
  { action: "visits:update",             resource: "visits",            operation: "update" },

  { action: "non-conformities:read",     resource: "non-conformities",  operation: "read"   },
  { action: "non-conformities:create",   resource: "non-conformities",  operation: "create" },
  { action: "non-conformities:delete",   resource: "non-conformities",  operation: "delete" },

  { action: "photos:create",             resource: "photos",            operation: "create" },
  { action: "photos:delete",             resource: "photos",            operation: "delete" },
```

Total after change: 35 permissions (29 − 4 + 10).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors. The `PermissionAction` type is inferred from the `as const` array and will now include the new action strings and exclude the old ones.

- [ ] **Step 3: Commit**

```bash
git add src/shared/rbac/permissions.catalog.ts
git commit -m "feat(rbac): replace inspections permissions with checklists/visits/non-conformities/photos"
```

---

## Task 3: Apartment Module Updates

**Files:**
- Modify: `src/modules/apartment/apartment.repository.ts`
- Modify: `src/modules/apartment/apartment.service.ts`

### Part A — `createWithRooms`: auto-create Checklist + ChecklistItems

The current `createWithRooms` transaction creates ApartmentRooms and ApartmentRoomServices. Spec 3 adds two more steps: create a Checklist for the apartment, then create a ChecklistItem for each ApartmentRoomService.

- [ ] **Step 1: Update `createWithRooms` in `apartment.repository.ts`**

The current loop body is:
```ts
const serviceData: { apartmentRoomId: number; serviceId: number }[] = [];

// createMany does not return IDs; sequential create is required to link services
for (const room of rooms) {
  const created = await tx.apartmentRoom.create({
    data: { apartmentId: apartment.id, roomId: room.id, name: room.name },
    select: { id: true },
  });
  for (const ds of room.defaultServices) {
    serviceData.push({ apartmentRoomId: created.id, serviceId: ds.serviceId });
  }
}

if (serviceData.length > 0) {
  await tx.apartmentRoomService.createMany({ data: serviceData });
}

const result = await tx.apartment.findUnique({
```

Replace with:
```ts
const serviceData: { apartmentRoomId: number; serviceId: number }[] = [];
const createdRoomIds: number[] = [];

// createMany does not return IDs; sequential create required to link services
for (const room of rooms) {
  const created = await tx.apartmentRoom.create({
    data: { apartmentId: apartment.id, roomId: room.id, name: room.name },
    select: { id: true },
  });
  createdRoomIds.push(created.id);
  for (const ds of room.defaultServices) {
    serviceData.push({ apartmentRoomId: created.id, serviceId: ds.serviceId });
  }
}

if (serviceData.length > 0) {
  await tx.apartmentRoomService.createMany({ data: serviceData });
}

// Step 4: Create Checklist (always — 1:1 with apartment)
const checklist = await tx.checklist.create({
  data: { apartmentId: apartment.id },
  select: { id: true },
});

// Step 5: Create ChecklistItem for each ApartmentRoomService
// createMany doesn't return IDs, so query them back using the created room IDs
if (createdRoomIds.length > 0) {
  const createdServices = await tx.apartmentRoomService.findMany({
    where: { apartmentRoomId: { in: createdRoomIds } },
    select: { id: true },
  });
  if (createdServices.length > 0) {
    await tx.checklistItem.createMany({
      data: createdServices.map((s) => ({
        checklistId: checklist.id,
        apartmentRoomServiceId: s.id,
      })),
    });
  }
}

const result = await tx.apartment.findUnique({
```

### Part B — `deleteApartment`: guard against checklist existence

Every instantiated apartment now has a Checklist. Attempting to delete one via the DB FK will throw P2003. Add a pre-check for a clear 409 error message instead.

- [ ] **Step 2: Add `findChecklistByApartmentId` to `ApartmentRepository`**

Add this method after `findApartmentRoom`:
```ts
async findChecklistByApartmentId(apartmentId: number) {
  return prisma.checklist.findUnique({
    where: { apartmentId },
    select: { id: true },
  });
}
```

- [ ] **Step 3: Add guard in `apartment.service.ts` `deleteApartment`**

Find the `deleteApartment` method in `apartment.service.ts`. It currently reads the apartment then calls `this.repo.delete(id)`. Add the checklist check between the 404 check and the delete call:

```ts
const checklist = await this.repo.findChecklistByApartmentId(id);
if (checklist) throw new HttpError(409, "Apartment has a checklist and cannot be deleted.");
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/apartment/apartment.repository.ts src/modules/apartment/apartment.service.ts
git commit -m "feat(apartment): auto-create Checklist+ChecklistItems on instantiation, guard delete"
```

---

## Task 4: Module `checklist`

**Files:**
- Create: `src/modules/checklist/checklist.schema.ts`
- Create: `src/modules/checklist/checklist.repository.ts`
- Create: `src/modules/checklist/checklist.service.ts`
- Create: `src/modules/checklist/checklist.controller.ts`
- Create: `src/modules/checklist/checklist.routes.ts`
- Modify: `src/main/app.ts`

Routes: `GET /checklists`, `GET /checklists/:id`, `PATCH /checklists/:id`, `POST /checklists/:id/visits`, `GET /checklists/:id/visits`

- [ ] **Step 1: Create `checklist.schema.ts`**

```ts
import { z } from "zod";

export const checklistParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const checklistQuerySchema = z.object({
  apartmentId: z.coerce.number().int().positive().optional(),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(["PENDING", "FINALIZED"]).optional(),
});

export const createVisitSchema = z.object({
  inspectorId: z.number().int().positive(),
});

export type ChecklistParams = z.infer<typeof checklistParamsSchema>;
export type ChecklistQuery = z.infer<typeof checklistQuerySchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
```

- [ ] **Step 2: Create `checklist.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { UpdateChecklistInput, CreateVisitInput } from "./checklist.schema.js";

const CHECKLIST_LIST_SELECT = {
  id: true,
  apartmentId: true,
  title: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  apartment: {
    select: {
      id: true,
      identifier: true,
      building: { select: { id: true, name: true } },
    },
  },
  finalizedBy: { select: { id: true, name: true } },
} as const;

const CHECKLIST_DETAIL_SELECT = {
  id: true,
  apartmentId: true,
  title: true,
  status: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  apartment: {
    select: {
      id: true,
      identifier: true,
      building: { select: { id: true, name: true } },
    },
  },
  finalizedBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      status: true,
      apartmentRoomServiceId: true,
      createdAt: true,
      updatedAt: true,
      apartmentRoomService: {
        select: {
          id: true,
          service: { select: { id: true, name: true, category: true } },
          apartmentRoom: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
  visits: {
    select: {
      id: true,
      status: true,
      finalizedAt: true,
      createdAt: true,
      inspector: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

const VISIT_SUMMARY_SELECT = {
  id: true,
  status: true,
  observations: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  inspector: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export class ChecklistRepository {
  async findAll(apartmentId?: number) {
    return prisma.checklist.findMany({
      ...(apartmentId !== undefined && { where: { apartmentId } }),
      select: CHECKLIST_LIST_SELECT,
      orderBy: { createdAt: "desc" as const },
    });
  }

  async findById(id: number) {
    return prisma.checklist.findUnique({ where: { id }, select: CHECKLIST_DETAIL_SELECT });
  }

  async update(
    id: number,
    data: {
      title?: string;
      status?: "PENDING" | "FINALIZED";
      finalizedById?: number | null;
      finalizedAt?: Date | null;
    },
  ) {
    return prisma.checklist.update({
      where: { id },
      data,
      select: CHECKLIST_LIST_SELECT,
    });
  }

  async findPendingOrNokItems(checklistId: number) {
    return prisma.checklistItem.findMany({
      where: { checklistId, status: { in: ["PENDING", "NOK"] } },
      select: { id: true },
    });
  }

  async createVisitWithItems(
    checklistId: number,
    inspectorId: number,
    createdById: number,
    itemIds: number[],
  ) {
    return prisma.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: { checklistId, inspectorId, createdById, status: "ONGOING" },
        select: { id: true },
      });

      await tx.visitItem.createMany({
        data: itemIds.map((checklistItemId) => ({
          visitId: visit.id,
          checklistItemId,
          status: "PENDING",
        })),
      });

      return tx.visit.findUnique({
        where: { id: visit.id },
        select: VISIT_SUMMARY_SELECT,
      });
    });
  }

  async findVisits(checklistId: number) {
    return prisma.visit.findMany({
      where: { checklistId },
      select: VISIT_SUMMARY_SELECT,
      orderBy: { createdAt: "desc" as const },
    });
  }
}
```

- [ ] **Step 3: Create `checklist.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { ChecklistRepository } from "./checklist.repository.js";
import type { UpdateChecklistInput, CreateVisitInput } from "./checklist.schema.js";

export class ChecklistService {
  constructor(private repo: ChecklistRepository) {}

  async listChecklists(apartmentId?: number) {
    return this.repo.findAll(apartmentId);
  }

  async getChecklist(id: number) {
    const checklist = await this.repo.findById(id);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    return checklist;
  }

  async updateChecklist(id: number, input: UpdateChecklistInput, userId: number) {
    const checklist = await this.repo.findById(id);
    if (!checklist) throw new HttpError(404, "Checklist not found.");

    const updateData: {
      title?: string;
      status?: "PENDING" | "FINALIZED";
      finalizedById?: number | null;
      finalizedAt?: Date | null;
    } = {};

    if (input.title !== undefined) updateData.title = input.title;

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === "FINALIZED") {
        updateData.finalizedById = userId;
        updateData.finalizedAt = new Date();
      } else {
        updateData.finalizedById = null;
        updateData.finalizedAt = null;
      }
    }

    return this.repo.update(id, updateData);
  }

  async createVisit(checklistId: number, input: CreateVisitInput, createdById: number) {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    if (checklist.status === "FINALIZED") {
      throw new HttpError(409, "Checklist is already finalized.");
    }

    const items = await this.repo.findPendingOrNokItems(checklistId);
    if (items.length === 0) {
      throw new HttpError(409, "No items to inspect in this checklist.");
    }

    return this.repo.createVisitWithItems(
      checklistId,
      input.inspectorId,
      createdById,
      items.map((i) => i.id),
    );
  }

  async listVisits(checklistId: number) {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new HttpError(404, "Checklist not found.");
    return this.repo.findVisits(checklistId);
  }
}
```

- [ ] **Step 4: Create `checklist.controller.ts`**

```ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ChecklistService } from "./checklist.service.js";
import type {
  ChecklistParams,
  ChecklistQuery,
  UpdateChecklistInput,
  CreateVisitInput,
} from "./checklist.schema.js";

export class ChecklistController {
  constructor(private service: ChecklistService) {}

  async list(
    request: FastifyRequest<{ Querystring: ChecklistQuery }>,
    reply: FastifyReply,
  ) {
    const checklists = await this.service.listChecklists(request.query.apartmentId);
    return reply.status(200).send(checklists);
  }

  async getOne(
    request: FastifyRequest<{ Params: ChecklistParams }>,
    reply: FastifyReply,
  ) {
    const checklist = await this.service.getChecklist(request.params.id);
    return reply.status(200).send(checklist);
  }

  async update(
    request: FastifyRequest<{ Params: ChecklistParams; Body: UpdateChecklistInput }>,
    reply: FastifyReply,
  ) {
    const userId = Number(request.user.sub);
    const checklist = await this.service.updateChecklist(
      request.params.id,
      request.body,
      userId,
    );
    return reply.status(200).send(checklist);
  }

  async createVisit(
    request: FastifyRequest<{ Params: ChecklistParams; Body: CreateVisitInput }>,
    reply: FastifyReply,
  ) {
    const createdById = Number(request.user.sub);
    const visit = await this.service.createVisit(
      request.params.id,
      request.body,
      createdById,
    );
    return reply.status(201).send(visit);
  }

  async listVisits(
    request: FastifyRequest<{ Params: ChecklistParams }>,
    reply: FastifyReply,
  ) {
    const visits = await this.service.listVisits(request.params.id);
    return reply.status(200).send(visits);
  }
}
```

- [ ] **Step 5: Create `checklist.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ChecklistRepository } from "./checklist.repository.js";
import { ChecklistService } from "./checklist.service.js";
import { ChecklistController } from "./checklist.controller.js";
import {
  checklistParamsSchema,
  checklistQuerySchema,
  updateChecklistSchema,
  createVisitSchema,
} from "./checklist.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const checklistRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ChecklistRepository();
  const service = new ChecklistService(repo);
  const controller = new ChecklistController(service);

  app.get(
    "/",
    {
      schema: { querystring: checklistQuerySchema },
      preHandler: [app.authenticate, checkPermission("checklists:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: checklistParamsSchema },
      preHandler: [app.authenticate, checkPermission("checklists:read")],
    },
    controller.getOne.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: checklistParamsSchema, body: updateChecklistSchema },
      preHandler: [app.authenticate, checkPermission("checklists:update")],
    },
    controller.update.bind(controller),
  );

  app.post(
    "/:id/visits",
    {
      schema: { params: checklistParamsSchema, body: createVisitSchema },
      preHandler: [app.authenticate, checkPermission("visits:create")],
    },
    controller.createVisit.bind(controller),
  );

  app.get(
    "/:id/visits",
    {
      schema: { params: checklistParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.listVisits.bind(controller),
  );
};
```

- [ ] **Step 6: Register in `app.ts`**

Add import and registration after `serviceRoutes`:

```ts
import { checklistRoutes } from "../modules/checklist/checklist.routes.js";
```

```ts
await app.register(checklistRoutes, { prefix: "/checklists" });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/checklist/ src/main/app.ts
git commit -m "feat(checklist): CRUD module at /checklists with visit creation sub-route"
```

---

## Task 5: Module `visit`

**Files:**
- Create: `src/modules/visit/visit.schema.ts`
- Create: `src/modules/visit/visit.repository.ts`
- Create: `src/modules/visit/visit.service.ts`
- Create: `src/modules/visit/visit.controller.ts`
- Create: `src/modules/visit/visit.routes.ts`
- Modify: `src/main/app.ts`

Routes: `GET /visits/:id`, `PATCH /visits/:id` (finalize), `PATCH /visits/:id/items/:itemId`, `POST /visits/:id/items/:itemId/non-conformities`, `DELETE /visits/:id/items/:itemId/non-conformities`

- [ ] **Step 1: Create `visit.schema.ts`**

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
  status: z.enum(["PENDING", "OK", "NOK"]),
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

- [ ] **Step 2: Create `visit.repository.ts`**

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
    items: Array<{ checklistItemId: number; status: "PENDING" | "OK" | "NOK" }>,
    input: FinalizeVisitInput,
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
          data: { status: "FINALIZED" },
        });
      }

      return tx.visit.findUnique({ where: { id: visitId }, select: VISIT_DETAIL_SELECT });
    });
  }

  async updateVisitItemWithNcCleanup(
    itemId: number,
    newStatus: "PENDING" | "OK" | "NOK",
    currentStatus: string,
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

- [ ] **Step 3: Create `visit.service.ts`**

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

  async finalizeVisit(id: number, input: FinalizeVisitInput) {
    const visit = await this.repo.findById(id);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const pendingItems = visit.items.filter((i) => i.status === "PENDING");
    if (pendingItems.length > 0) {
      throw new HttpError(400, "All items must be evaluated before finalizing.");
    }

    const nokWithoutNc = visit.items.filter(
      (i) => i.status === "NOK" && !i.nonConformity,
    );
    if (nokWithoutNc.length > 0) {
      throw new HttpError(400, "All NOK items must have a non-conformity recorded.");
    }

    return this.repo.applyFinalization(visit.id, visit.checklistId, visit.items, input);
  }

  async updateVisitItem(visitId: number, itemId: number, input: UpdateVisitItemInput) {
    const visit = await this.repo.findById(visitId);
    if (!visit) throw new HttpError(404, "Visit not found.");
    if (visit.status === "FINALIZED") throw new HttpError(400, "Visit is already finalized.");

    const item = visit.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "Visit item not found.");

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

- [ ] **Step 4: Create `visit.controller.ts`**

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

export class VisitController {
  constructor(private service: VisitService) {}

  async getOne(
    request: FastifyRequest<{ Params: VisitParams }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.getVisit(request.params.id);
    return reply.status(200).send(visit);
  }

  async finalize(
    request: FastifyRequest<{ Params: VisitParams; Body: FinalizeVisitInput }>,
    reply: FastifyReply,
  ) {
    const visit = await this.service.finalizeVisit(request.params.id, request.body);
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

- [ ] **Step 5: Create `visit.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { VisitRepository } from "./visit.repository.js";
import { VisitService } from "./visit.service.js";
import { VisitController } from "./visit.controller.js";
import {
  visitParamsSchema,
  visitItemParamsSchema,
  finalizeVisitSchema,
  updateVisitItemSchema,
  addNonConformitySchema,
} from "./visit.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const visitRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new VisitRepository();
  const service = new VisitService(repo);
  const controller = new VisitController(service);

  app.get(
    "/:id",
    {
      schema: { params: visitParamsSchema },
      preHandler: [app.authenticate, checkPermission("visits:read")],
    },
    controller.getOne.bind(controller),
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

- [ ] **Step 6: Register in `app.ts`**

Add import after checklistRoutes:
```ts
import { visitRoutes } from "../modules/visit/visit.routes.js";
```

Add registration after `checklistRoutes`:
```ts
await app.register(visitRoutes, { prefix: "/visits" });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/visit/ src/main/app.ts
git commit -m "feat(visit): module at /visits with finalization, item update, and NC management"
```

---

## Task 6: Module `non-conformity`

**Files:**
- Create: `src/modules/non-conformity/non-conformity.schema.ts`
- Create: `src/modules/non-conformity/non-conformity.repository.ts`
- Create: `src/modules/non-conformity/non-conformity.service.ts`
- Create: `src/modules/non-conformity/non-conformity.controller.ts`
- Create: `src/modules/non-conformity/non-conformity.routes.ts`
- Modify: `src/main/app.ts`

Routes: `POST /non-conformities/:id/photos`, `DELETE /non-conformities/:id/photos/:photoId`

- [ ] **Step 1: Create `non-conformity.schema.ts`**

```ts
import { z } from "zod";

export const ncParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const photoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

export const addPhotoSchema = z.object({
  url: z.string().url().max(500),
});

export type NcParams = z.infer<typeof ncParamsSchema>;
export type PhotoParams = z.infer<typeof photoParamsSchema>;
export type AddPhotoInput = z.infer<typeof addPhotoSchema>;
```

- [ ] **Step 2: Create `non-conformity.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { AddPhotoInput } from "./non-conformity.schema.js";

export class NonConformityRepository {
  async findById(id: number) {
    return prisma.nonConformity.findUnique({
      where: { id },
      select: { id: true, visitItemId: true },
    });
  }

  async findPhoto(ncId: number, photoId: number) {
    return prisma.photo.findFirst({
      where: { id: photoId, nonConformityId: ncId },
      select: { id: true },
    });
  }

  async addPhoto(ncId: number, data: AddPhotoInput) {
    return prisma.photo.create({
      data: { nonConformityId: ncId, url: data.url },
      select: { id: true, url: true, uploadedAt: true },
    });
  }

  async deletePhoto(photoId: number) {
    return prisma.photo.delete({ where: { id: photoId }, select: { id: true } });
  }
}
```

- [ ] **Step 3: Create `non-conformity.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { NonConformityRepository } from "./non-conformity.repository.js";
import type { AddPhotoInput } from "./non-conformity.schema.js";

export class NonConformityService {
  constructor(private repo: NonConformityRepository) {}

  async addPhoto(ncId: number, input: AddPhotoInput) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    return this.repo.addPhoto(ncId, input);
  }

  async deletePhoto(ncId: number, photoId: number) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    return this.repo.deletePhoto(photoId);
  }
}
```

- [ ] **Step 4: Create `non-conformity.controller.ts`**

```ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { NonConformityService } from "./non-conformity.service.js";
import type { NcParams, PhotoParams, AddPhotoInput } from "./non-conformity.schema.js";

export class NonConformityController {
  constructor(private service: NonConformityService) {}

  async addPhoto(
    request: FastifyRequest<{ Params: NcParams; Body: AddPhotoInput }>,
    reply: FastifyReply,
  ) {
    const photo = await this.service.addPhoto(request.params.id, request.body);
    return reply.status(201).send(photo);
  }

  async deletePhoto(
    request: FastifyRequest<{ Params: PhotoParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deletePhoto(request.params.id, request.params.photoId);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `non-conformity.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { NonConformityRepository } from "./non-conformity.repository.js";
import { NonConformityService } from "./non-conformity.service.js";
import { NonConformityController } from "./non-conformity.controller.js";
import { ncParamsSchema, photoParamsSchema, addPhotoSchema } from "./non-conformity.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const nonConformityRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new NonConformityRepository();
  const service = new NonConformityService(repo);
  const controller = new NonConformityController(service);

  app.post(
    "/:id/photos",
    {
      schema: { params: ncParamsSchema, body: addPhotoSchema },
      preHandler: [app.authenticate, checkPermission("photos:create")],
    },
    controller.addPhoto.bind(controller),
  );

  app.delete(
    "/:id/photos/:photoId",
    {
      schema: { params: photoParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:delete")],
    },
    controller.deletePhoto.bind(controller),
  );
};
```

- [ ] **Step 6: Register in `app.ts`**

Add import after visitRoutes:
```ts
import { nonConformityRoutes } from "../modules/non-conformity/non-conformity.routes.js";
```

Add registration after `visitRoutes`:
```ts
await app.register(nonConformityRoutes, { prefix: "/non-conformities" });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/non-conformity/ src/main/app.ts
git commit -m "feat(non-conformity): photo management sub-routes at /non-conformities"
```

---

## Task 7: Insomnia Collection

**Files:**
- Modify: `insomnia-collection.json`

Add three new folders to the Insomnia collection. Use the existing `Local` environment variable `{{base_url}}` and `{{bearer_token}}` auth pattern.

- [ ] **Step 1: Add Checklists folder**

Add a new folder `Checklists` with these requests:

| Name | Method | URL |
|---|---|---|
| List Checklists | GET | `{{base_url}}/checklists` |
| List Checklists by Apartment | GET | `{{base_url}}/checklists?apartmentId=1` |
| Get Checklist | GET | `{{base_url}}/checklists/1` |
| Update Checklist (title) | PATCH | `{{base_url}}/checklists/1` — body: `{"title":"Pré-entrega Apto 101"}` |
| Finalize Checklist | PATCH | `{{base_url}}/checklists/1` — body: `{"status":"FINALIZED"}` |
| Reopen Checklist | PATCH | `{{base_url}}/checklists/1` — body: `{"status":"PENDING"}` |
| Create Visit | POST | `{{base_url}}/checklists/1/visits` — body: `{"inspectorId":2}` |
| List Visits | GET | `{{base_url}}/checklists/1/visits` |

- [ ] **Step 2: Add Visits folder**

Add a new folder `Visits` with these requests:

| Name | Method | URL |
|---|---|---|
| Get Visit | GET | `{{base_url}}/visits/1` |
| Finalize Visit | PATCH | `{{base_url}}/visits/1` — body: `{"status":"FINALIZED","observations":"Tudo conforme"}` |
| Update Visit Item (OK) | PATCH | `{{base_url}}/visits/1/items/1` — body: `{"status":"OK"}` |
| Update Visit Item (NOK) | PATCH | `{{base_url}}/visits/1/items/1` — body: `{"status":"NOK"}` |
| Add Non-Conformity | POST | `{{base_url}}/visits/1/items/1/non-conformities` — body: `{"description":"Pintura com manchas visíveis"}` |
| Delete Non-Conformity | DELETE | `{{base_url}}/visits/1/items/1/non-conformities` |

- [ ] **Step 3: Add Non-Conformities folder**

Add a new folder `Non-Conformities` with these requests:

| Name | Method | URL |
|---|---|---|
| Add Photo | POST | `{{base_url}}/non-conformities/1/photos` — body: `{"url":"https://example.com/photo.jpg"}` |
| Delete Photo | DELETE | `{{base_url}}/non-conformities/1/photos/1` |

All requests use `Authorization: Bearer {{bearer_token}}` header matching existing collection pattern.

- [ ] **Step 4: Commit**

```bash
git add insomnia-collection.json
git commit -m "chore(insomnia): add Checklists, Visits and Non-Conformities requests for Spec 3"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Rename Inspection → Checklist (@@map Inspection) | Task 1 |
| New enums: ChecklistStatus, ChecklistItemStatus, VisitStatus | Task 1 |
| ChecklistItem, Visit, VisitItem, NonConformity, Photo models | Task 1 |
| User backlinks for named relations | Task 1 |
| Replace inspections:* with 10 new permissions | Task 2 |
| POST /apartments auto-creates Checklist + ChecklistItems | Task 3 |
| DELETE /apartments 409 if checklist exists | Task 3 |
| GET/PATCH /checklists, GET/PATCH /:id | Task 4 |
| POST /checklists/:id/visits (409 if FINALIZED or no items) | Task 4 |
| GET /checklists/:id/visits | Task 4 |
| PATCH /checklists/:id finalizedById+finalizedAt on finalize, clear on reopen | Task 4 |
| GET /visits/:id with items + NCs + photos | Task 5 |
| PATCH /visits/:id finalization transaction (validate → sync items → auto-finalize checklist) | Task 5 |
| PATCH /visits/:id/items/:itemId — NC deleted when status leaves NOK | Task 5 |
| POST/DELETE /visits/:id/items/:itemId/non-conformities | Task 5 |
| POST /non-conformities/:id/photos | Task 6 |
| DELETE /non-conformities/:id/photos/:photoId | Task 6 |
| Insomnia requests | Task 7 |

**Type consistency:** `ChecklistItemStatus` enum values (`PENDING`/`OK`/`NOK`) reused across `ChecklistItem.status`, `VisitItem.status`, and `updateVisitItemSchema`. `VisitItem.status` in `VISIT_DETAIL_SELECT` is typed as `"PENDING" | "OK" | "NOK"` by Prisma and passed as-is to `applyFinalization`.

**No placeholders found.**
