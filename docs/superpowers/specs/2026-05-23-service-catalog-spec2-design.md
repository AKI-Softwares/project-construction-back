# Spec 2 — Service Catalog Design

**Date:** 2026-05-23  
**Branch:** feat/rooms-service  
**Status:** approved  
**Depends on:** Spec 1 (Building, ApartmentType, Room, Apartment, ApartmentRoom, ApartmentRoomService)

---

## Overview

Spec 2 introduces the global service catalog (`Service`) and the mechanism for associating default services to room templates (`RoomDefaultService`). When a new apartment is instantiated (`POST /apartments`), the transaction now also copies `RoomDefaultService` entries into `ApartmentRoomService`, giving the apartment a complete pre-populated structure out of the box.

---

## Schema Changes

### `Service` (expand existing stub)

Add fields:
- `description String? @db.VarChar(500)`
- `category String? @db.VarChar(100)` — free text, no normalization
- `@@unique([name])` — name must be globally unique
- Relation: `roomDefaultServices RoomDefaultService[]`

### `RoomDefaultService` (new junction table)

```prisma
model RoomDefaultService {
  roomId    Int
  serviceId Int
  room      Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@id([roomId, serviceId])
  @@index([serviceId])
  @@map("RoomDefaultService")
}
```

- `onDelete: Cascade` on `roomId` — deleting a Room template removes its default services automatically
- `onDelete: Restrict` on `serviceId` — database-level guard preventing deletion of a Service that has active defaults (backed by 409 guard in the service layer)
- `Room` gains relation `defaultServices RoomDefaultService[]`

---

## Module: `service` (new)

**Prefix:** `/services`

### Routes

| Method | Path | RBAC | Notes |
|---|---|---|---|
| GET | `/services` | `services:read` | Optional `?category=X` filter |
| GET | `/services/:id` | `services:read` | 404 if not found |
| POST | `/services` | `services:create` | 409 if name already exists |
| PATCH | `/services/:id` | `services:update` | Partial update: name, description, category |
| DELETE | `/services/:id` | `services:delete` | 409 if has active references |

### Business Rules

- `name` is globally unique — pre-check + P2002 catch (established pattern from Spec 1)
- `DELETE` checks two relations before proceeding:
  1. `ApartmentRoomService` (instances) — if any exist → 409
  2. `RoomDefaultService` (templates) — if any exist → 409
- `category` is stored as-is; no enum, no normalization
- `GET /services?category=X` filters by case-insensitive match on `category` field (Prisma `mode: 'insensitive'` on PostgreSQL)

### Files

- `src/modules/service/service.schema.ts`
- `src/modules/service/service.repository.ts`
- `src/modules/service/service.service.ts`
- `src/modules/service/service.controller.ts`
- `src/modules/service/service.routes.ts`

---

## Module: `apartment-type` (extended)

Three new sub-routes managing default services for a room template.

### New Routes

| Method | Path | RBAC | Notes |
|---|---|---|---|
| GET | `/apartment-types/:id/rooms/:roomId/services` | `apartment-types:read` | List `RoomDefaultService` for the room |
| POST | `/apartment-types/:id/rooms/:roomId/services` | `apartment-types:update` | Body: `{ serviceId }` — 409 if already associated |
| DELETE | `/apartment-types/:id/rooms/:roomId/services/:serviceId` | `apartment-types:update` | 404 if association does not exist |

### Business Rules

- Every route validates `ApartmentType (:id)` exists → 404
- Every route validates `Room (:roomId)` belongs to `ApartmentType (:id)` → 404
- POST validates `Service (serviceId)` exists → 404
- POST pre-checks uniqueness `(roomId, serviceId)` + P2002 catch

### Files modified

- `apartment-type.routes.ts` — 3 new routes
- `apartment-type.controller.ts` — 3 new handlers
- `apartment-type.service.ts` — 3 new methods
- `apartment-type.repository.ts` — queries for `RoomDefaultService`
- `apartment-type.schema.ts` — Zod schema for `{ serviceId }` body and extended params

---

## Update: `POST /apartments` Transaction

### Before (Spec 1)

```
$transaction:
  1. create Apartment
  2. createMany ApartmentRoom (from ApartmentType.rooms)
```

### After (Spec 2)

```
$transaction:
  1. create Apartment
  2. createMany ApartmentRoom (from ApartmentType.rooms)
  3. for each ApartmentRoom created:
       createMany ApartmentRoomService (from room.defaultServices)
```

### Changes

- `apartment.repository.ts` — `findApartmentTypeWithRooms` includes `defaultServices` in the select
- `apartment.repository.ts` — `createWithRooms` receives defaults and runs `createMany ApartmentRoomService` in the same transaction
- `apartment.service.ts` — passes defaults through to repo (no new business logic)

### Edge Cases

- Room with no `RoomDefaultService` → `ApartmentRoom` created with no services (no error)
- After instantiation, `ApartmentRoomService` records are fully independent from the template

---

## RBAC

4 new permissions added to the catalog:

| action | resource | operation |
|---|---|---|
| `services:read` | `services` | `read` |
| `services:create` | `services` | `create` |
| `services:update` | `services` | `update` |
| `services:delete` | `services` | `delete` |

Added via migration (`INSERT INTO "Permission"`). Roles assigned following the same pattern as `buildings:*` in the existing seed/migration.

---

## Deferred Decision

**Inline Service creation on association route:**  
`POST /apartment-types/:id/rooms/:roomId/services` accepts only `{ serviceId }`. Inline creation (accepting `{ name, description?, category? }` to create-and-associate in one call) was deferred to avoid unnecessary complexity (discriminated union + dual responsibility on the route). Revisit if user feedback demands this flow.

---

## Delivery Checklist

- [ ] Migration: expand `Service` + create `RoomDefaultService`
- [ ] New module `service` — 5 files
- [ ] Register `/services` in `app.ts`
- [ ] Extend `apartment-type` module — 3 new sub-routes + schema
- [ ] Update `apartment.repository.ts` — `findApartmentTypeWithRooms` + `createWithRooms`
- [ ] Update `apartment.service.ts` — pass defaults through
- [ ] RBAC migration — 4 new permissions
- [ ] Update Insomnia collection
