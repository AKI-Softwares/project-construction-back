# Spec 3 — Inspection (Checklist + Visit) Design

**Date:** 2026-05-25
**Branch:** feat/inspection (to create)
**Status:** approved
**Depends on:** Spec 1 (Apartment, ApartmentRoom, ApartmentRoomService), Spec 2 (Service)

---

## Overview

Spec 3 introduces the inspection workflow: each apartment has a **Checklist** (document auto-created at apartment instantiation) containing one **ChecklistItem** per service. The backoffice creates **Visits** assigning an inspector. The inspector evaluates items, records **NonConformities** for NOK items, and finalizes the visit. The system auto-finalizes the Checklist when all items pass. Full traceability via VisitItem history across multiple visits.

---

## Domain Vocabulary

| Term | Meaning |
|---|---|
| **Checklist** | Living document for an apartment. 1:1 with Apartment. Tracks current inspection state. |
| **ChecklistItem** | Current status of one service in a checklist (PENDING / OK / NOK). |
| **Visit** | Inspection event created by backoffice, assigned to an inspector. |
| **VisitItem** | Per-item assessment within a specific visit. History record. |
| **NonConformity** | Issue recorded by inspector for a NOK VisitItem. |
| **Photo** | URL of a photo attached to a NonConformity (upload deferred to Spec 4). |

---

## Schema Changes

### Rename `Inspection` model → `Checklist`

The dormant `Inspection` model is repurposed as `Checklist`. DB table name stays `"Inspection"` via `@@map("Inspection")` — no table rename migration required.

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

enum ChecklistStatus { PENDING  FINALIZED }
```

`@@unique([apartmentId])` — 1 checklist per apartment.
`title` optional — e.g. "Inspeção de Pré-entrega".
`finalizedById` + `finalizedAt` — compliance: who closed and when.

### New: `ChecklistItem`

```prisma
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

enum ChecklistItemStatus { PENDING  OK  NOK }
```

`onDelete: Restrict` on `apartmentRoomService` — preserves inspection history even if service is later removed.

### New: `Visit`

```prisma
model Visit {
  id          Int         @id @default(autoincrement())
  checklistId Int         @map("checklist_id")
  inspectorId Int         @map("inspector_id")
  createdById Int         @map("created_by_id")
  observations String?    @db.Text
  status      VisitStatus @default(ONGOING)
  finalizedAt DateTime?   @map("finalized_at") @db.Timestamptz
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  checklist   Checklist   @relation(fields: [checklistId], references: [id])
  inspector   User        @relation("VisitInspector", fields: [inspectorId], references: [id])
  createdBy   User        @relation("VisitCreatedBy", fields: [createdById], references: [id])
  items       VisitItem[]

  @@index([checklistId])
  @@index([inspectorId])
  @@map("Visit")
}

enum VisitStatus { ONGOING  FINALIZED }
```

`inspectorId` — who performed the visit.
`createdById` — backoffice user who created it.
`finalizedAt` — when inspector submitted.

### New: `VisitItem`

```prisma
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
```

Reuses `ChecklistItemStatus` enum (PENDING/OK/NOK).
`onDelete: Cascade` from Visit — deleting a Visit removes its VisitItems.
`onDelete: Restrict` from ChecklistItem — ChecklistItem cannot be deleted while VisitItem history exists.

### New: `NonConformity`

```prisma
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
```

`@@unique([visitItemId])` — one NonConformity per VisitItem.
`onDelete: Cascade` from VisitItem — deleting VisitItem removes its NC.

### New: `Photo`

```prisma
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

`url` only — actual upload deferred to Spec 4.

### Enum migration

Replace `InspectionStatus { PENDING APPROVED REJECTED }` with new enums.
Table is dormant (no real data) — safe to recreate.

```sql
-- Drop old enum, create new ones
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE VARCHAR(20);
DROP TYPE "InspectionStatus";
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'FINALIZED');
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'OK', 'NOK');
CREATE TYPE "VisitStatus" AS ENUM ('ONGOING', 'FINALIZED');
ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE "ChecklistStatus"
  USING 'PENDING'::"ChecklistStatus";
```

### Update to `POST /apartments` transaction

`apartment.repository.ts` — `createWithRooms` gains two new steps (same `$transaction`):

```
Step 4: CREATE Checklist (apartmentId, status PENDING)
Step 5: CREATE ChecklistItem for each ApartmentRoomService (status PENDING)
```

After Step 3's `createMany`, query back IDs via `tx.apartmentRoomService.findMany({ where: { apartmentRoomId: { in: createdRoomIds } }, select: { id: true } })` — `createMany` does not return IDs.

---

## Modules and Routes

### Module `checklist` — prefix `/checklists`

| Method | Route | Actor | Description |
|---|---|---|---|
| GET | `/checklists` | both | list; filter `?apartmentId=N` |
| GET | `/checklists/:id` | both | detail with items + visits |
| PATCH | `/checklists/:id` | backoffice | update `title` or `status` (finalize/reopen) |
| POST | `/checklists/:id/visits` | backoffice | create visit (assigns inspector, auto-creates VisitItems) |
| GET | `/checklists/:id/visits` | both | list visits |

No `POST /checklists` — creation is automatic via `POST /apartments`.

### Module `visit` — prefix `/visits`

| Method | Route | Actor | Description |
|---|---|---|---|
| GET | `/visits/:id` | both | full detail (items + NCs + photos) |
| PATCH | `/visits/:id` | inspector | finalize (`status: FINALIZED`) + `observations` |
| PATCH | `/visits/:id/items/:itemId` | inspector | mark item OK / NOK / PENDING |
| POST | `/visits/:id/items/:itemId/non-conformities` | inspector | add NC to NOK item |
| DELETE | `/visits/:id/items/:itemId/non-conformities` | backoffice | remove NC |

### Module `non-conformity` — prefix `/non-conformities`

| Method | Route | Actor | Description |
|---|---|---|---|
| POST | `/non-conformities/:id/photos` | inspector | add photo URL |
| DELETE | `/non-conformities/:id/photos/:photoId` | backoffice | remove photo |

---

## Business Logic

### Auto-creation: `POST /apartments` transaction (update)

```
Existing steps 1–3: create Apartment + ApartmentRooms + ApartmentRoomServices
New step 4: create Checklist { apartmentId, status: PENDING }
New step 5: create ChecklistItem for each ApartmentRoomService { status: PENDING }
```

### Auto-creation: `POST /checklists/:id/visits` transaction

```
1. Verify Checklist exists and is PENDING (409 if FINALIZED)
2. Fetch ChecklistItems where status IN (PENDING, NOK)
3. If zero items → 409 "No items to inspect"
4. Create Visit { checklistId, inspectorId, createdById, status: ONGOING }
5. Create VisitItem for each fetched ChecklistItem { visitId, checklistItemId, status: PENDING }
```

### Visit finalization: `PATCH /visits/:id` with `status: FINALIZED`

All steps inside `$transaction`:

```
1. Verify Visit is ONGOING (400 if already FINALIZED)
2. Verify all VisitItems have status OK or NOK (400 if any PENDING)
3. Verify every NOK VisitItem has a NonConformity (400 if missing)
4. For each VisitItem: update corresponding ChecklistItem.status = VisitItem.status
5. Set Visit.status = FINALIZED, Visit.finalizedAt = now()
6. If all ChecklistItems are OK → set Checklist.status = FINALIZED (auto)
   Else → Checklist remains PENDING
```

### Checklist finalize/reopen: `PATCH /checklists/:id`

**Finalize** (`status: FINALIZED`):
- Capture `finalizedById` = JWT sub, `finalizedAt` = now()

**Reopen** (`status: PENDING`):
- Clear `finalizedById` = null, `finalizedAt` = null
- Does NOT auto-create a new Visit — backoffice creates one manually after reopening

### Updating a VisitItem: `PATCH /visits/:id/items/:itemId`

- Inspector can change status to OK, NOK, or back to PENDING
- Changing from NOK → OK or PENDING: if NonConformity exists → delete it (cascade removes photos)
- Changing to NOK: NonConformity must be added separately via POST

---

## Error Handling

| Situation | Code | Message |
|---|---|---|
| Finalize visit with PENDING VisitItem | 400 | "All items must be evaluated before finalizing." |
| Finalize visit with NOK item missing NC | 400 | "All NOK items must have a non-conformity recorded." |
| Finalize already-FINALIZED visit | 400 | "Visit is already finalized." |
| Create visit on FINALIZED checklist | 409 | "Checklist is already finalized." |
| Create visit with no PENDING/NOK items | 409 | "No items to inspect in this checklist." |
| Add NC to non-NOK VisitItem | 409 | "Non-conformity can only be added to NOK items." |
| Add duplicate NC to same VisitItem | 409 | "This item already has a non-conformity." |
| Delete Checklist with visits | 409 | "Checklist has visits and cannot be deleted." |
| Inspector attempts delete action | 403 | (RBAC via checkPermission) |

---

## RBAC

New permissions (4 resources × standard operations):

| Resource | Actions |
|---|---|
| `checklists` | read, update |
| `visits` | read, create, update |
| `non-conformities` | read, create, delete |
| `photos` | create, delete |

No `checklists:create` or `checklists:delete` — checklist lifecycle is managed via apartment instantiation and status transitions only.

Inspector role: `checklists:read`, `visits:read`, `visits:update`, `non-conformities:read`, `non-conformities:create`, `photos:create`.

Backoffice (Administrator): all permissions above plus `visits:create`, `non-conformities:delete`, `photos:delete`.

---

## Cascade Chain

```
Apartment (delete) → BLOCKED if Checklist exists (409)
Checklist (delete) → BLOCKED if Visit exists (409)
Visit (delete)     → cascade VisitItem → cascade NonConformity → cascade Photo
ApartmentRoomService → ChecklistItem: onDelete Restrict
ChecklistItem → VisitItem: onDelete Restrict
VisitItem → NonConformity: onDelete Cascade → Photo: onDelete Cascade
```

---

## Implementation Notes

### User model relation backlinks

`Checklist` and `Visit` both have multiple named relations to `User`. The `User` model in `prisma/schema.prisma` must be updated with explicit backlink fields (no DB column change — Prisma virtual only):

```prisma
// Add to User model:
checklistsFinalized Checklist[] @relation("ChecklistFinalizedBy")
visitsAsInspector   Visit[]     @relation("VisitInspector")
visitsCreated       Visit[]     @relation("VisitCreatedBy")
```

### Inspection table migration

`Inspection` table is dormant (no real data). Migration will:
1. Drop enum `InspectionStatus`, create `ChecklistStatus`, `ChecklistItemStatus`, `VisitStatus`
2. Drop columns `name`, `observations` from `Inspection`
3. Add `apartment_id INTEGER NOT NULL UNIQUE`, `title VARCHAR(255)`, `finalized_by_id INTEGER`, `finalized_at TIMESTAMPTZ`
4. Add FK constraints

Safe to add `NOT NULL` column since table has no data.

---

## Out of Scope (Spec 3)

- Photo upload endpoint — Spec 4 (storage provider TBD: Cloudflare R2 recommended)
- Inspector role creation and assignment — assumes role exists via seed
- GET /visits (list by inspector) — can be added later; not required for MVP. Inspector can discover visits via `GET /checklists?apartmentId=N` as workaround.
- Inspector role seed — assumes `Inspector` role is created and assigned separately

---

## Related

- [[2026-05-23-core-modules-design]] — domain design and decomposition
- [[2026-05-23-spec1-structural-implementation]] — Spec 1 base
- [[2026-05-24-spec2-service-catalog-implementation]] — Spec 2 base
- [[2026-05-19-rbac-roles]] — permission catalog
