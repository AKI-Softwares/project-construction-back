# Spec 1 — Core Structural Modules

**Date:** 2026-05-23
**Status:** approved — ready for implementation plan
**Depends on:** none (first spec)
**Followed by:** Spec 2 (Service Catalog), Spec 3 (Inspection)

---

## Context

The checkobra system inspects construction apartments. The structural layer defines how buildings, apartment templates, and apartment instances are modeled. It is the foundation every other domain feature builds on.

Current `prisma/schema.prisma` has legacy models (`Apartment` v1, `Dependency`) that will be **replaced** by this spec. No production data exists in those tables — safe to drop via migration.

---

## Domain Model

### Entities

**`Building`** — a real-estate development (empreendimento). Stores address and geolocation for future map/routing APIs on mobile.

**`ApartmentType`** — a reusable apartment template. Defines which rooms exist and (via `RoomDefaultService`) which services each room defaults to. Multiple buildings can share the same type. Types are independent of specific buildings.

**`Room`** — a room within an `ApartmentType` template (e.g. "Quarto 1", "Banheiro", "Sala"). Belongs to exactly one type. Defines the default service set (Spec 2). Removing a room from a type does **not** affect existing apartment instances.

**`Apartment`** — a physical unit instance within a `Building`, typed by an `ApartmentType`. Identified by a free-form string (`identifier`: "101", "PH1", "101A") unique within its building. Created by instantiating a type: rooms and services are copied at creation time and evolve independently thereafter.

**`ApartmentRoom`** — an instance-level room derived from a `Room` template at apartment creation. Name is inherited but freely editable. Its service set starts from the template defaults and is freely editable without affecting the type.

**`ApartmentRoomService`** — a service associated to a specific `ApartmentRoom`. Populated from `RoomDefaultService` at instantiation. Can be freely added or removed per instance at any time.

### Relationships

```
Building         1──N  Apartment
ApartmentType    1──N  Room
ApartmentType    1──N  Apartment
Apartment        1──N  ApartmentRoom
Room             1──N  ApartmentRoom        (source template reference)
ApartmentRoom    1──N  ApartmentRoomService
Service          1──N  ApartmentRoomService (FK — Service defined in Spec 2)
```

### Prisma schema additions

```prisma
model Building {
  id          Int         @id @default(autoincrement())
  name        String
  address     String
  latitude    Float?
  longitude   Float?
  createdAt   DateTime    @default(now()) @db.Timestamptz
  updatedAt   DateTime    @updatedAt @db.Timestamptz
  apartments  Apartment[]
  @@map("Building")
}

model ApartmentType {
  id          Int         @id @default(autoincrement())
  name        String      @unique
  description String?
  createdAt   DateTime    @default(now()) @db.Timestamptz
  updatedAt   DateTime    @updatedAt @db.Timestamptz
  rooms       Room[]
  apartments  Apartment[]
  @@map("ApartmentType")
}

model Room {
  id              Int                  @id @default(autoincrement())
  apartmentTypeId Int
  name            String
  createdAt       DateTime             @default(now()) @db.Timestamptz
  updatedAt       DateTime             @updatedAt @db.Timestamptz
  apartmentType   ApartmentType        @relation(fields: [apartmentTypeId], references: [id])
  defaultServices RoomDefaultService[]
  apartmentRooms  ApartmentRoom[]
  @@map("Room")
}

model Apartment {
  id              Int             @id @default(autoincrement())
  buildingId      Int
  apartmentTypeId Int
  identifier      String          // "101", "PH1", "101A" — free-form
  floor           Int?
  block           String?
  createdAt       DateTime        @default(now()) @db.Timestamptz
  updatedAt       DateTime        @updatedAt @db.Timestamptz
  building        Building        @relation(fields: [buildingId], references: [id])
  apartmentType   ApartmentType   @relation(fields: [apartmentTypeId], references: [id])
  rooms           ApartmentRoom[]
  @@unique([buildingId, identifier])
  @@map("Apartment")
}

model ApartmentRoom {
  id            Int                    @id @default(autoincrement())
  apartmentId   Int
  roomId        Int?                   // nullable — set to null when source Room template is deleted
  name          String
  createdAt     DateTime               @default(now()) @db.Timestamptz
  updatedAt     DateTime               @updatedAt @db.Timestamptz
  apartment     Apartment              @relation(fields: [apartmentId], references: [id])
  room          Room?                  @relation(fields: [roomId], references: [id], onDelete: SetNull)
  services      ApartmentRoomService[]
  @@map("ApartmentRoom")
}

model ApartmentRoomService {
  id              Int           @id @default(autoincrement())
  apartmentRoomId Int
  serviceId       Int
  createdAt       DateTime      @default(now()) @db.Timestamptz
  apartmentRoom   ApartmentRoom @relation(fields: [apartmentRoomId], references: [id])
  service         Service       @relation(fields: [serviceId], references: [id])
  @@unique([apartmentRoomId, serviceId])
  @@map("ApartmentRoomService")
}

// Minimal stub — Spec 2 adds description, category, RoomDefaultService
model Service {
  id                    Int                    @id @default(autoincrement())
  name                  String
  createdAt             DateTime               @default(now()) @db.Timestamptz
  updatedAt             DateTime               @updatedAt @db.Timestamptz
  apartmentRoomServices ApartmentRoomService[]
  @@map("Service")
}
```

> **Note on `ApartmentRoom.roomId` nullable:** Deleting a `Room` template sets `roomId` to null on all derived `ApartmentRoom` instances via `onDelete: SetNull`. The instance keeps its `name` and all `ApartmentRoomService` records — it simply loses the back-reference to the template. Type changes never mutate existing instances.

> **Note on `Service` stub:** Full `Service` model (description, category, `RoomDefaultService`) is defined in Spec 2. The stub here is the minimum to make the `ApartmentRoomService` FK valid. Spec 2 adds fields via a new migration without dropping this model.

---

## Instantiation Flow

`POST /apartments` triggers the central operation of this spec:

1. Validate `buildingId` exists → `404` if not
2. Validate `apartmentTypeId` exists → `404` if not
3. Validate `identifier` is unique within building → `409` if taken
4. In a single Prisma transaction:
   a. Create `Apartment`
   b. For each `Room` in the `ApartmentType`:
      - Create `ApartmentRoom` (name = room.name, roomId = room.id)
      - For each `RoomDefaultService` of that room:
        - Create `ApartmentRoomService` (serviceId = default.serviceId)
5. Return created apartment with rooms and services included

---

## Modules (fractal modular pattern)

Four modules, each with 5 files (`schema`, `repository`, `service`, `controller`, `routes`):

| Module | Prefix | Source path |
|---|---|---|
| `building` | `/buildings` | `src/modules/building/` |
| `apartment-type` | `/apartment-types` | `src/modules/apartment-type/` |
| `room` | `/rooms` (nested under apartment-type) | `src/modules/room/` |
| `apartment` | `/apartments` | `src/modules/apartment/` |

---

## API Surface

### Buildings

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/buildings` | `buildings:read` | List; includes `_count.apartments` |
| GET | `/buildings/:id` | `buildings:read` | Includes apartments array |
| POST | `/buildings` | `buildings:create` | lat/lng optional |
| PATCH | `/buildings/:id` | `buildings:update` | All fields optional |
| DELETE | `/buildings/:id` | `buildings:delete` | `409` if has apartments |

### Apartment Types

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/apartment-types` | `apartment-types:read` | Includes rooms |
| GET | `/apartment-types/:id` | `apartment-types:read` | Includes rooms + defaultServices count |
| POST | `/apartment-types` | `apartment-types:create` | — |
| PATCH | `/apartment-types/:id` | `apartment-types:update` | name, description |
| DELETE | `/apartment-types/:id` | `apartment-types:delete` | `409` if has apartment instances |
| POST | `/apartment-types/:id/rooms` | `apartment-types:update` | Add room to type |
| DELETE | `/apartment-types/:id/rooms/:roomId` | `apartment-types:update` | Remove room from type |

### Apartments

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/apartments` | `apartments:read` | Filter by `?buildingId=` |
| GET | `/apartments/:id` | `apartments:read` | Includes rooms + services per room |
| POST | `/apartments` | `apartments:create` | Triggers instantiation flow |
| PATCH | `/apartments/:id` | `apartments:update` | identifier, floor, block |
| DELETE | `/apartments/:id` | `apartments:delete` | `409` if has inspections (Spec 3) |
| POST | `/apartments/:id/rooms/:roomId/services` | `apartments:update` | Add service to room instance |
| DELETE | `/apartments/:id/rooms/:roomId/services/:serviceId` | `apartments:update` | Remove service from room instance |
| PATCH | `/apartments/:id/rooms/:roomId` | `apartments:update` | Edit room name |

---

## Business Rules

| Rule | Behavior |
|---|---|
| Duplicate `identifier` in same building | `409 "Apartment identifier already exists in this building."` |
| Duplicate `ApartmentType.name` | `409 "Apartment type name already exists."` |
| Delete building with apartments | `409 "Building has apartments and cannot be deleted."` |
| Delete apartment type with instances | `409 "Apartment type has apartment instances and cannot be deleted."` |
| Delete apartment with inspections | `409 "Apartment has inspections and cannot be deleted."` (guard for Spec 3) |
| Duplicate service in same ApartmentRoom | `409 "Service already added to this room."` |
| Type instantiation with no rooms | Allowed — apartment is created with no rooms (empty); rooms can be added to instance directly |

---

## RBAC Permissions to Add to Catalog

Add to `src/shared/rbac/permissions.catalog.ts`:

```ts
// buildings
{ action: "buildings:read",   resource: "buildings", operation: "read"   },
{ action: "buildings:create", resource: "buildings", operation: "create" },
{ action: "buildings:update", resource: "buildings", operation: "update" },
{ action: "buildings:delete", resource: "buildings", operation: "delete" },
// apartment-types
{ action: "apartment-types:read",   resource: "apartment-types", operation: "read"   },
{ action: "apartment-types:create", resource: "apartment-types", operation: "create" },
{ action: "apartment-types:update", resource: "apartment-types", operation: "update" },
{ action: "apartment-types:delete", resource: "apartment-types", operation: "delete" },
// apartments
{ action: "apartments:read",   resource: "apartments", operation: "read"   },
{ action: "apartments:create", resource: "apartments", operation: "create" },
{ action: "apartments:update", resource: "apartments", operation: "update" },
{ action: "apartments:delete", resource: "apartments", operation: "delete" },
```

Run `npm run db:seed` after adding to upsert into `Permission` table.

---

## Migration Notes

Legacy models to drop in this migration:
- `Apartment` v1 (floor + number columns, old unique constraint)
- `Dependency`
- `Checklist` references to `Apartment`/`Dependency` (Checklist itself dropped in Spec 3)

Since no production data exists in these tables, the migration is a clean drop + recreate.

---

## Out of Scope (handled in later specs)

- `Service` model and `RoomDefaultService` → Spec 2
- `Inspection`, `Visit`, `VisitItem`, `NonConformity`, `Photo` → Spec 3
- Photo upload / storage provider → Spec 3
- Mobile-specific endpoints → Spec 3
- Third `VisitItem` status (beyond OK/NOK) → Spec 3 (user to confirm)
