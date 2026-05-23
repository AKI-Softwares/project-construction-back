# Core Structural Modules — Spec 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Building, ApartmentType, Room, Apartment, ApartmentRoom, and ApartmentRoomService — the structural foundation of the checkobra inspection domain.

**Architecture:** Fractal modular pattern — 4 modules (`building`, `apartment-type`, `apartment`, `room` sub-routes embedded in apartment-type), each with 5 files (schema → repository → service → controller → routes). Schema migration drops legacy models (`Apartment` v1, `Dependency`, `Checklist`) and adds 5 new tables. Apartment creation triggers an instantiation transaction that copies rooms from the ApartmentType template.

**Tech Stack:** Fastify v5, Prisma v7, Zod v4, TypeScript ESM (NodeNext), `fastify-type-provider-zod`, `exactOptionalPropertyTypes: true` in tsconfig (use `...(x !== undefined && { field: x })` spread for optional fields).

**Note on testing:** No test runner is configured in this project. Verification is done via `npx tsc --noEmit` (type correctness) and manual smoke tests via the local dev server.

---

## File Map

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Modify | `src/shared/rbac/permissions.catalog.ts` |
| Modify | `src/main/app.ts` |
| Create | `src/modules/building/building.schema.ts` |
| Create | `src/modules/building/building.repository.ts` |
| Create | `src/modules/building/building.service.ts` |
| Create | `src/modules/building/building.controller.ts` |
| Create | `src/modules/building/building.routes.ts` |
| Create | `src/modules/apartment-type/apartment-type.schema.ts` |
| Create | `src/modules/apartment-type/apartment-type.repository.ts` |
| Create | `src/modules/apartment-type/apartment-type.service.ts` |
| Create | `src/modules/apartment-type/apartment-type.controller.ts` |
| Create | `src/modules/apartment-type/apartment-type.routes.ts` |
| Create | `src/modules/apartment/apartment.schema.ts` |
| Create | `src/modules/apartment/apartment.repository.ts` |
| Create | `src/modules/apartment/apartment.service.ts` |
| Create | `src/modules/apartment/apartment.controller.ts` |
| Create | `src/modules/apartment/apartment.routes.ts` |

---

## Task 0: Schema migration + RBAC permissions

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/shared/rbac/permissions.catalog.ts`

- [ ] **Step 1: Replace `prisma/schema.prisma` with the new schema**

Full replacement — drops legacy models, adds all Spec 1 tables:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum InspectionStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(255)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  roleId       Int      @map("role_id")
  role         Role     @relation(fields: [roleId], references: [id])
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("User")
}

model Role {
  id          Int          @id @default(autoincrement())
  name        String       @unique @db.VarChar(255)
  description String?      @db.VarChar(500)
  isSystem    Boolean      @default(false) @map("is_system")
  permissions Permission[] @relation("RolePermissions")
  users       User[]
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("Role")
}

model Permission {
  id        Int      @id @default(autoincrement())
  action    String   @unique @db.VarChar(100)
  resource  String   @db.VarChar(50)
  operation String   @db.VarChar(50)
  roles     Role[]   @relation("RolePermissions")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([resource, operation])
  @@map("Permission")
}

model Building {
  id         Int           @id @default(autoincrement())
  name       String        @db.VarChar(255)
  address    String        @db.VarChar(500)
  latitude   Float?
  longitude  Float?
  createdAt  DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartments Apartment[]

  @@map("Building")
}

model ApartmentType {
  id          Int         @id @default(autoincrement())
  name        String      @unique @db.VarChar(255)
  description String?     @db.VarChar(500)
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  rooms       Room[]
  apartments  Apartment[]

  @@map("ApartmentType")
}

model Room {
  id              Int             @id @default(autoincrement())
  apartmentTypeId Int             @map("apartment_type_id")
  name            String          @db.VarChar(255)
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartmentType   ApartmentType   @relation(fields: [apartmentTypeId], references: [id])
  apartmentRooms  ApartmentRoom[]

  @@map("Room")
}

model Apartment {
  id              Int             @id @default(autoincrement())
  buildingId      Int             @map("building_id")
  apartmentTypeId Int             @map("apartment_type_id")
  identifier      String          @db.VarChar(50)
  floor           Int?
  block           String?         @db.VarChar(50)
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  building        Building        @relation(fields: [buildingId], references: [id])
  apartmentType   ApartmentType   @relation(fields: [apartmentTypeId], references: [id])
  rooms           ApartmentRoom[]

  @@unique([buildingId, identifier])
  @@map("Apartment")
}

model ApartmentRoom {
  id            Int                    @id @default(autoincrement())
  apartmentId   Int                    @map("apartment_id")
  roomId        Int?                   @map("room_id")
  name          String                 @db.VarChar(255)
  createdAt     DateTime               @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartment     Apartment              @relation(fields: [apartmentId], references: [id])
  room          Room?                  @relation(fields: [roomId], references: [id], onDelete: SetNull)
  services      ApartmentRoomService[]

  @@map("ApartmentRoom")
}

model ApartmentRoomService {
  id              Int           @id @default(autoincrement())
  apartmentRoomId Int           @map("apartment_room_id")
  serviceId       Int           @map("service_id")
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz
  apartmentRoom   ApartmentRoom @relation(fields: [apartmentRoomId], references: [id])
  service         Service       @relation(fields: [serviceId], references: [id])

  @@unique([apartmentRoomId, serviceId])
  @@map("ApartmentRoomService")
}

// Minimal stub — Spec 2 adds description, category, RoomDefaultService
model Service {
  id                    Int                    @id @default(autoincrement())
  name                  String                 @db.VarChar(255)
  createdAt             DateTime               @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartmentRoomServices ApartmentRoomService[]

  @@map("Service")
}

// Dormant until Spec 3 — relations to Service/Checklist removed; new relations added in Spec 3
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

- [ ] **Step 2: Add `apartment-types` permissions to the catalog**

In `src/shared/rbac/permissions.catalog.ts`, add 4 entries after the `buildings:delete` line:

```ts
  { action: "apartment-types:read",   resource: "apartment-types", operation: "read"   },
  { action: "apartment-types:create", resource: "apartment-types", operation: "create" },
  { action: "apartment-types:update", resource: "apartment-types", operation: "update" },
  { action: "apartment-types:delete", resource: "apartment-types", operation: "delete" },
```

The full updated `PERMISSIONS` array will then have `buildings:*` followed by `apartment-types:*` followed by `apartments:*`.

- [ ] **Step 3: Run migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `core-structural-spec1`

Expected output: migration created and applied, no errors.

- [ ] **Step 4: Run seed to upsert new permissions**

```bash
npm run db:seed
```

Expected: `apartment-types:read/create/update/delete` upserted into `Permission` table and added to `Administrator` role.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The Prisma generated client is updated automatically by the migration.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/shared/rbac/permissions.catalog.ts
git commit -m "feat(schema): replace legacy models with Spec 1 structural schema

Drops: Apartment v1, Dependency, Checklist, Service v1 (inspectionId).
Adds: ApartmentType, Room, Apartment v2, ApartmentRoom, ApartmentRoomService,
      Service stub, Building lat/lng. Inspection kept dormant (Spec 3).
Adds apartment-types:* to permission catalog."
```

---

## Task 1: Building module

**Files:**
- Create: `src/modules/building/building.schema.ts`
- Create: `src/modules/building/building.repository.ts`
- Create: `src/modules/building/building.service.ts`
- Create: `src/modules/building/building.controller.ts`
- Create: `src/modules/building/building.routes.ts`
- Modify: `src/main/app.ts`

- [ ] **Step 1: Create `src/modules/building/building.schema.ts`**

```ts
import { z } from "zod";

export const createBuildingSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const buildingParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type BuildingParams = z.infer<typeof buildingParamsSchema>;
```

- [ ] **Step 2: Create `src/modules/building/building.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { CreateBuildingInput, UpdateBuildingInput } from "./building.schema.js";

const BUILDING_LIST_SELECT = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { apartments: true } },
} as const;

const BUILDING_DETAIL_SELECT = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  apartments: {
    select: { id: true, identifier: true, floor: true, block: true },
    orderBy: { identifier: "asc" as const },
  },
} as const;

export class BuildingRepository {
  async findAll() {
    return prisma.building.findMany({
      select: BUILDING_LIST_SELECT,
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return prisma.building.findUnique({
      where: { id },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async create(data: CreateBuildingInput) {
    return prisma.building.create({
      data: {
        name: data.name,
        address: data.address,
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
      },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async update(id: number, data: UpdateBuildingInput) {
    return prisma.building.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
      },
      select: BUILDING_DETAIL_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.building.delete({ where: { id } });
  }

  async countApartments(id: number) {
    return prisma.apartment.count({ where: { buildingId: id } });
  }
}
```

- [ ] **Step 3: Create `src/modules/building/building.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { BuildingRepository } from "./building.repository.js";
import type { CreateBuildingInput, UpdateBuildingInput } from "./building.schema.js";

export class BuildingService {
  constructor(private readonly repo: BuildingRepository) {}

  async listBuildings() {
    return this.repo.findAll();
  }

  async getBuilding(id: number) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    return building;
  }

  async createBuilding(input: CreateBuildingInput) {
    return this.repo.create(input);
  }

  async updateBuilding(id: number, input: UpdateBuildingInput) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    return this.repo.update(id, input);
  }

  async deleteBuilding(id: number) {
    const building = await this.repo.findById(id);
    if (!building) throw new HttpError(404, "Building not found.");
    const apartmentCount = await this.repo.countApartments(id);
    if (apartmentCount > 0) {
      throw new HttpError(409, "Building has apartments and cannot be deleted.");
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Create `src/modules/building/building.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { BuildingService } from "./building.service.js";
import type { BuildingParams, CreateBuildingInput, UpdateBuildingInput } from "./building.schema.js";

export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await this.service.listBuildings());
  }

  async getOne(request: FastifyRequest<{ Params: BuildingParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getBuilding(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateBuildingInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createBuilding(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: BuildingParams; Body: UpdateBuildingInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.updateBuilding(request.params.id, request.body));
  }

  async remove(request: FastifyRequest<{ Params: BuildingParams }>, reply: FastifyReply) {
    await this.service.deleteBuilding(request.params.id);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `src/modules/building/building.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { BuildingRepository } from "./building.repository.js";
import { BuildingService } from "./building.service.js";
import { BuildingController } from "./building.controller.js";
import {
  buildingParamsSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from "./building.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const buildingRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new BuildingRepository();
  const service = new BuildingService(repo);
  const controller = new BuildingController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("buildings:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: buildingParamsSchema },
      preHandler: [app.authenticate, checkPermission("buildings:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createBuildingSchema },
      preHandler: [app.authenticate, checkPermission("buildings:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: buildingParamsSchema, body: updateBuildingSchema },
      preHandler: [app.authenticate, checkPermission("buildings:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: buildingParamsSchema },
      preHandler: [app.authenticate, checkPermission("buildings:delete")],
    },
    controller.remove.bind(controller),
  );
};
```

- [ ] **Step 6: Register building routes in `src/main/app.ts`**

Add the import and registration after the `permissionRoutes` lines:

```ts
// add to imports at the top:
import { buildingRoutes } from "../modules/building/building.routes.js";

// add to module registrations:
await app.register(buildingRoutes, { prefix: "/buildings" });
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Smoke test (server must be running: `npm run dev`)**

```bash
# 1. Login and capture token (replace credentials with your super-admin)
# Use Insomnia: POST /auth/login → copy token to env var

# 2. Create a building
curl -s -X POST http://localhost:3333/buildings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Residencial Alfa","address":"Rua das Flores, 100","latitude":-23.5505,"longitude":-46.6333}'
# Expected: 201 + building object with id

# 3. List buildings
curl -s http://localhost:3333/buildings \
  -H "Authorization: Bearer <token>"
# Expected: 200 + array with the created building + _count.apartments: 0

# 4. Get by id
curl -s http://localhost:3333/buildings/1 \
  -H "Authorization: Bearer <token>"
# Expected: 200 + building with apartments: []

# 5. Update
curl -s -X PATCH http://localhost:3333/buildings/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Residencial Alfa II"}'
# Expected: 200 + updated object

# 6. Delete (should succeed — no apartments yet)
curl -s -X DELETE http://localhost:3333/buildings/1 \
  -H "Authorization: Bearer <token>"
# Expected: 204

# 7. Get deleted building
curl -s http://localhost:3333/buildings/1 \
  -H "Authorization: Bearer <token>"
# Expected: 404
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/building/ src/main/app.ts
git commit -m "feat(building): add CRUD module with lat/lng and apartment count"
```

---

## Task 2: ApartmentType module (with Room sub-routes)

**Files:**
- Create: `src/modules/apartment-type/apartment-type.schema.ts`
- Create: `src/modules/apartment-type/apartment-type.repository.ts`
- Create: `src/modules/apartment-type/apartment-type.service.ts`
- Create: `src/modules/apartment-type/apartment-type.controller.ts`
- Create: `src/modules/apartment-type/apartment-type.routes.ts`
- Modify: `src/main/app.ts`

- [ ] **Step 1: Create `src/modules/apartment-type/apartment-type.schema.ts`**

```ts
import { z } from "zod";

export const createApartmentTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export const updateApartmentTypeSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});

export const apartmentTypeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const roomParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

export const createRoomSchema = z.object({
  name: z.string().min(2),
});

export type CreateApartmentTypeInput = z.infer<typeof createApartmentTypeSchema>;
export type UpdateApartmentTypeInput = z.infer<typeof updateApartmentTypeSchema>;
export type ApartmentTypeParams = z.infer<typeof apartmentTypeParamsSchema>;
export type RoomParams = z.infer<typeof roomParamsSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
```

- [ ] **Step 2: Create `src/modules/apartment-type/apartment-type.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type {
  CreateApartmentTypeInput,
  CreateRoomInput,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

const ROOM_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

const APARTMENT_TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  rooms: { select: ROOM_SELECT, orderBy: { name: "asc" as const } },
  _count: { select: { apartments: true } },
} as const;

export class ApartmentTypeRepository {
  async findAll() {
    return prisma.apartmentType.findMany({
      select: APARTMENT_TYPE_SELECT,
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return prisma.apartmentType.findUnique({
      where: { id },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async findByName(name: string) {
    return prisma.apartmentType.findUnique({ where: { name }, select: { id: true } });
  }

  async create(data: CreateApartmentTypeInput) {
    return prisma.apartmentType.create({
      data: {
        name: data.name,
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async update(id: number, data: UpdateApartmentTypeInput) {
    return prisma.apartmentType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: APARTMENT_TYPE_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.apartmentType.delete({ where: { id } });
  }

  async countApartments(id: number) {
    return prisma.apartment.count({ where: { apartmentTypeId: id } });
  }

  async addRoom(apartmentTypeId: number, data: CreateRoomInput) {
    return prisma.room.create({
      data: { apartmentTypeId, name: data.name },
      select: ROOM_SELECT,
    });
  }

  async findRoom(apartmentTypeId: number, roomId: number) {
    return prisma.room.findFirst({
      where: { id: roomId, apartmentTypeId },
      select: { id: true },
    });
  }

  async deleteRoom(roomId: number) {
    return prisma.room.delete({ where: { id: roomId } });
  }
}
```

- [ ] **Step 3: Create `src/modules/apartment-type/apartment-type.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { ApartmentTypeRepository } from "./apartment-type.repository.js";
import type {
  CreateApartmentTypeInput,
  CreateRoomInput,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

export class ApartmentTypeService {
  constructor(private readonly repo: ApartmentTypeRepository) {}

  async listApartmentTypes() {
    return this.repo.findAll();
  }

  async getApartmentType(id: number) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    return type;
  }

  async createApartmentType(input: CreateApartmentTypeInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) throw new HttpError(409, "Apartment type name already exists.");
    return this.repo.create(input);
  }

  async updateApartmentType(id: number, input: UpdateApartmentTypeInput) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    if (input.name && input.name !== type.name) {
      const existing = await this.repo.findByName(input.name);
      if (existing) throw new HttpError(409, "Apartment type name already exists.");
    }
    return this.repo.update(id, input);
  }

  async deleteApartmentType(id: number) {
    const type = await this.repo.findById(id);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const count = await this.repo.countApartments(id);
    if (count > 0) {
      throw new HttpError(409, "Apartment type has apartment instances and cannot be deleted.");
    }
    await this.repo.delete(id);
  }

  async addRoom(apartmentTypeId: number, input: CreateRoomInput) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    return this.repo.addRoom(apartmentTypeId, input);
  }

  async removeRoom(apartmentTypeId: number, roomId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    await this.repo.deleteRoom(roomId);
  }
}
```

- [ ] **Step 4: Create `src/modules/apartment-type/apartment-type.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApartmentTypeService } from "./apartment-type.service.js";
import type {
  ApartmentTypeParams,
  CreateApartmentTypeInput,
  CreateRoomInput,
  RoomParams,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";

export class ApartmentTypeController {
  constructor(private readonly service: ApartmentTypeService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await this.service.listApartmentTypes());
  }

  async getOne(request: FastifyRequest<{ Params: ApartmentTypeParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getApartmentType(request.params.id));
  }

  async create(
    request: FastifyRequest<{ Body: CreateApartmentTypeInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(await this.service.createApartmentType(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: ApartmentTypeParams; Body: UpdateApartmentTypeInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(
      await this.service.updateApartmentType(request.params.id, request.body),
    );
  }

  async remove(request: FastifyRequest<{ Params: ApartmentTypeParams }>, reply: FastifyReply) {
    await this.service.deleteApartmentType(request.params.id);
    return reply.status(204).send();
  }

  async addRoom(
    request: FastifyRequest<{ Params: ApartmentTypeParams; Body: CreateRoomInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(
      await this.service.addRoom(request.params.id, request.body),
    );
  }

  async removeRoom(request: FastifyRequest<{ Params: RoomParams }>, reply: FastifyReply) {
    await this.service.removeRoom(request.params.id, request.params.roomId);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `src/modules/apartment-type/apartment-type.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApartmentTypeRepository } from "./apartment-type.repository.js";
import { ApartmentTypeService } from "./apartment-type.service.js";
import { ApartmentTypeController } from "./apartment-type.controller.js";
import {
  apartmentTypeParamsSchema,
  createApartmentTypeSchema,
  createRoomSchema,
  roomParamsSchema,
  updateApartmentTypeSchema,
} from "./apartment-type.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const apartmentTypeRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ApartmentTypeRepository();
  const service = new ApartmentTypeService(repo);
  const controller = new ApartmentTypeController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("apartment-types:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createApartmentTypeSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema, body: updateApartmentTypeSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: apartmentTypeParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:delete")],
    },
    controller.remove.bind(controller),
  );

  // Room sub-routes — managed under apartment-types:update permission
  app.post(
    "/:id/rooms",
    {
      schema: { params: apartmentTypeParamsSchema, body: createRoomSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.addRoom.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId",
    {
      schema: { params: roomParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.removeRoom.bind(controller),
  );
};
```

- [ ] **Step 6: Register in `src/main/app.ts`**

```ts
// add to imports:
import { apartmentTypeRoutes } from "../modules/apartment-type/apartment-type.routes.js";

// add to registrations:
await app.register(apartmentTypeRoutes, { prefix: "/apartment-types" });
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Smoke test (server running)**

```bash
# Create an apartment type
curl -s -X POST http://localhost:3333/apartment-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"2 Quartos Padrão","description":"Dois quartos, sala, cozinha, 1 banheiro"}'
# Expected: 201 + type object with id:1, rooms:[]

# Add rooms to the type
curl -s -X POST http://localhost:3333/apartment-types/1/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Quarto 1"}'
# Expected: 201 + room object

curl -s -X POST http://localhost:3333/apartment-types/1/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Banheiro"}'
# Expected: 201

# Get type with rooms
curl -s http://localhost:3333/apartment-types/1 \
  -H "Authorization: Bearer <token>"
# Expected: 200 + type with rooms array (2 items)

# Duplicate name check
curl -s -X POST http://localhost:3333/apartment-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"2 Quartos Padrão"}'
# Expected: 409

# Delete room
curl -s -X DELETE http://localhost:3333/apartment-types/1/rooms/1 \
  -H "Authorization: Bearer <token>"
# Expected: 204
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/apartment-type/ src/main/app.ts
git commit -m "feat(apartment-type): add CRUD module with room sub-routes"
```

---

## Task 3: Apartment module

**Files:**
- Create: `src/modules/apartment/apartment.schema.ts`
- Create: `src/modules/apartment/apartment.repository.ts`
- Create: `src/modules/apartment/apartment.service.ts`
- Create: `src/modules/apartment/apartment.controller.ts`
- Create: `src/modules/apartment/apartment.routes.ts`
- Modify: `src/main/app.ts`

- [ ] **Step 1: Create `src/modules/apartment/apartment.schema.ts`**

```ts
import { z } from "zod";

export const createApartmentSchema = z.object({
  buildingId: z.number().int().positive(),
  apartmentTypeId: z.number().int().positive(),
  identifier: z.string().min(1).max(50),
  floor: z.number().int().optional(),
  block: z.string().max(50).optional(),
});

export const updateApartmentSchema = z.object({
  identifier: z.string().min(1).max(50).optional(),
  floor: z.number().int().optional(),
  block: z.string().max(50).optional(),
});

export const updateApartmentRoomSchema = z.object({
  name: z.string().min(2),
});

export const addRoomServiceSchema = z.object({
  serviceId: z.number().int().positive(),
});

export const apartmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const apartmentRoomParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

export const apartmentRoomServiceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
});

export const apartmentQuerySchema = z.object({
  buildingId: z.coerce.number().int().positive().optional(),
});

export type CreateApartmentInput = z.infer<typeof createApartmentSchema>;
export type UpdateApartmentInput = z.infer<typeof updateApartmentSchema>;
export type UpdateApartmentRoomInput = z.infer<typeof updateApartmentRoomSchema>;
export type AddRoomServiceInput = z.infer<typeof addRoomServiceSchema>;
export type ApartmentParams = z.infer<typeof apartmentParamsSchema>;
export type ApartmentRoomParams = z.infer<typeof apartmentRoomParamsSchema>;
export type ApartmentRoomServiceParams = z.infer<typeof apartmentRoomServiceParamsSchema>;
export type ApartmentQuery = z.infer<typeof apartmentQuerySchema>;
```

- [ ] **Step 2: Create `src/modules/apartment/apartment.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { CreateApartmentInput, UpdateApartmentInput } from "./apartment.schema.js";

const APARTMENT_ROOM_SERVICE_SELECT = {
  id: true,
  serviceId: true,
  service: { select: { id: true, name: true } },
} as const;

const APARTMENT_ROOM_SELECT = {
  id: true,
  roomId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  services: { select: APARTMENT_ROOM_SERVICE_SELECT },
} as const;

const APARTMENT_LIST_SELECT = {
  id: true,
  buildingId: true,
  apartmentTypeId: true,
  identifier: true,
  floor: true,
  block: true,
  createdAt: true,
  updatedAt: true,
  building: { select: { id: true, name: true } },
  apartmentType: { select: { id: true, name: true } },
} as const;

const APARTMENT_DETAIL_SELECT = {
  ...APARTMENT_LIST_SELECT,
  rooms: {
    select: APARTMENT_ROOM_SELECT,
    orderBy: { name: "asc" as const },
  },
} as const;

export class ApartmentRepository {
  async findAll(buildingId?: number) {
    return prisma.apartment.findMany({
      where: buildingId !== undefined ? { buildingId } : undefined,
      select: APARTMENT_LIST_SELECT,
      orderBy: [{ buildingId: "asc" }, { identifier: "asc" }],
    });
  }

  async findById(id: number) {
    return prisma.apartment.findUnique({
      where: { id },
      select: APARTMENT_DETAIL_SELECT,
    });
  }

  async findByBuildingAndIdentifier(buildingId: number, identifier: string) {
    return prisma.apartment.findUnique({
      where: { buildingId_identifier: { buildingId, identifier } },
      select: { id: true },
    });
  }

  async findBuildingById(id: number) {
    return prisma.building.findUnique({ where: { id }, select: { id: true } });
  }

  async findApartmentTypeWithRooms(id: number) {
    return prisma.apartmentType.findUnique({
      where: { id },
      select: { id: true, rooms: { select: { id: true, name: true } } },
    });
  }

  async createWithRooms(
    input: CreateApartmentInput,
    rooms: { id: number; name: string }[],
  ) {
    return prisma.$transaction(async (tx) => {
      const apartment = await tx.apartment.create({
        data: {
          buildingId: input.buildingId,
          apartmentTypeId: input.apartmentTypeId,
          identifier: input.identifier,
          ...(input.floor !== undefined && { floor: input.floor }),
          ...(input.block !== undefined && { block: input.block }),
        },
      });

      if (rooms.length > 0) {
        await tx.apartmentRoom.createMany({
          data: rooms.map((room) => ({
            apartmentId: apartment.id,
            roomId: room.id,
            name: room.name,
          })),
        });
      }

      const result = await tx.apartment.findUnique({
        where: { id: apartment.id },
        select: APARTMENT_DETAIL_SELECT,
      });

      return result!;
    });
  }

  async update(id: number, data: UpdateApartmentInput) {
    return prisma.apartment.update({
      where: { id },
      data: {
        ...(data.identifier !== undefined && { identifier: data.identifier }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.block !== undefined && { block: data.block }),
      },
      select: APARTMENT_DETAIL_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.apartment.delete({ where: { id } });
  }

  // ApartmentRoom operations
  async findApartmentRoom(apartmentId: number, roomId: number) {
    return prisma.apartmentRoom.findFirst({
      where: { id: roomId, apartmentId },
      select: { id: true, name: true },
    });
  }

  async updateApartmentRoomName(roomId: number, name: string) {
    return prisma.apartmentRoom.update({
      where: { id: roomId },
      data: { name },
      select: APARTMENT_ROOM_SELECT,
    });
  }

  // ApartmentRoomService operations
  async findService(id: number) {
    return prisma.service.findUnique({ where: { id }, select: { id: true } });
  }

  async findApartmentRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.findUnique({
      where: { apartmentRoomId_serviceId: { apartmentRoomId, serviceId } },
      select: { id: true },
    });
  }

  async addRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.create({
      data: { apartmentRoomId, serviceId },
      select: APARTMENT_ROOM_SERVICE_SELECT,
    });
  }

  async deleteRoomService(apartmentRoomId: number, serviceId: number) {
    return prisma.apartmentRoomService.delete({
      where: { apartmentRoomId_serviceId: { apartmentRoomId, serviceId } },
    });
  }
}
```

- [ ] **Step 3: Create `src/modules/apartment/apartment.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { ApartmentRepository } from "./apartment.repository.js";
import type {
  AddRoomServiceInput,
  CreateApartmentInput,
  UpdateApartmentInput,
  UpdateApartmentRoomInput,
} from "./apartment.schema.js";

export class ApartmentService {
  constructor(private readonly repo: ApartmentRepository) {}

  async listApartments(buildingId?: number) {
    return this.repo.findAll(buildingId);
  }

  async getApartment(id: number) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    return apartment;
  }

  async createApartment(input: CreateApartmentInput) {
    const building = await this.repo.findBuildingById(input.buildingId);
    if (!building) throw new HttpError(404, "Building not found.");

    const type = await this.repo.findApartmentTypeWithRooms(input.apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");

    const existing = await this.repo.findByBuildingAndIdentifier(
      input.buildingId,
      input.identifier,
    );
    if (existing) {
      throw new HttpError(409, "Apartment identifier already exists in this building.");
    }

    return this.repo.createWithRooms(input, type.rooms);
  }

  async updateApartment(id: number, input: UpdateApartmentInput) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");

    if (input.identifier && input.identifier !== apartment.identifier) {
      const existing = await this.repo.findByBuildingAndIdentifier(
        apartment.buildingId,
        input.identifier,
      );
      if (existing) {
        throw new HttpError(409, "Apartment identifier already exists in this building.");
      }
    }

    return this.repo.update(id, input);
  }

  async deleteApartment(id: number) {
    const apartment = await this.repo.findById(id);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    await this.repo.delete(id);
  }

  async updateRoomName(apartmentId: number, roomId: number, input: UpdateApartmentRoomInput) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    return this.repo.updateApartmentRoomName(roomId, input.name);
  }

  async addServiceToRoom(
    apartmentId: number,
    roomId: number,
    input: AddRoomServiceInput,
  ) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    const service = await this.repo.findService(input.serviceId);
    if (!service) throw new HttpError(404, "Service not found.");
    const existing = await this.repo.findApartmentRoomService(roomId, input.serviceId);
    if (existing) throw new HttpError(409, "Service already added to this room.");
    return this.repo.addRoomService(roomId, input.serviceId);
  }

  async removeServiceFromRoom(apartmentId: number, roomId: number, serviceId: number) {
    const apartment = await this.repo.findById(apartmentId);
    if (!apartment) throw new HttpError(404, "Apartment not found.");
    const room = await this.repo.findApartmentRoom(apartmentId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment.");
    const link = await this.repo.findApartmentRoomService(roomId, serviceId);
    if (!link) throw new HttpError(404, "Service not linked to this room.");
    await this.repo.deleteRoomService(roomId, serviceId);
  }
}
```

- [ ] **Step 4: Create `src/modules/apartment/apartment.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApartmentService } from "./apartment.service.js";
import type {
  AddRoomServiceInput,
  ApartmentParams,
  ApartmentQuery,
  ApartmentRoomParams,
  ApartmentRoomServiceParams,
  CreateApartmentInput,
  UpdateApartmentInput,
  UpdateApartmentRoomInput,
} from "./apartment.schema.js";

export class ApartmentController {
  constructor(private readonly service: ApartmentService) {}

  async list(request: FastifyRequest<{ Querystring: ApartmentQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.listApartments(request.query.buildingId));
  }

  async getOne(request: FastifyRequest<{ Params: ApartmentParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getApartment(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateApartmentInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createApartment(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: ApartmentParams; Body: UpdateApartmentInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.updateApartment(request.params.id, request.body));
  }

  async remove(request: FastifyRequest<{ Params: ApartmentParams }>, reply: FastifyReply) {
    await this.service.deleteApartment(request.params.id);
    return reply.status(204).send();
  }

  async updateRoom(
    request: FastifyRequest<{ Params: ApartmentRoomParams; Body: UpdateApartmentRoomInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(
      await this.service.updateRoomName(
        request.params.id,
        request.params.roomId,
        request.body,
      ),
    );
  }

  async addService(
    request: FastifyRequest<{ Params: ApartmentRoomParams; Body: AddRoomServiceInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(
      await this.service.addServiceToRoom(
        request.params.id,
        request.params.roomId,
        request.body,
      ),
    );
  }

  async removeService(
    request: FastifyRequest<{ Params: ApartmentRoomServiceParams }>,
    reply: FastifyReply,
  ) {
    await this.service.removeServiceFromRoom(
      request.params.id,
      request.params.roomId,
      request.params.serviceId,
    );
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `src/modules/apartment/apartment.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApartmentRepository } from "./apartment.repository.js";
import { ApartmentService } from "./apartment.service.js";
import { ApartmentController } from "./apartment.controller.js";
import {
  addRoomServiceSchema,
  apartmentParamsSchema,
  apartmentQuerySchema,
  apartmentRoomParamsSchema,
  apartmentRoomServiceParamsSchema,
  createApartmentSchema,
  updateApartmentRoomSchema,
  updateApartmentSchema,
} from "./apartment.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const apartmentRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ApartmentRepository();
  const service = new ApartmentService(repo);
  const controller = new ApartmentController(service);

  app.get(
    "/",
    {
      schema: { querystring: apartmentQuerySchema },
      preHandler: [app.authenticate, checkPermission("apartments:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: apartmentParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createApartmentSchema },
      preHandler: [app.authenticate, checkPermission("apartments:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: apartmentParamsSchema, body: updateApartmentSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: apartmentParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:delete")],
    },
    controller.remove.bind(controller),
  );

  // ApartmentRoom sub-routes
  app.patch(
    "/:id/rooms/:roomId",
    {
      schema: { params: apartmentRoomParamsSchema, body: updateApartmentRoomSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.updateRoom.bind(controller),
  );

  app.post(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: apartmentRoomParamsSchema, body: addRoomServiceSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.addService.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId/services/:serviceId",
    {
      schema: { params: apartmentRoomServiceParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartments:update")],
    },
    controller.removeService.bind(controller),
  );
};
```

- [ ] **Step 6: Register in `src/main/app.ts`**

```ts
// add to imports:
import { apartmentRoutes } from "../modules/apartment/apartment.routes.js";

// add to registrations:
await app.register(apartmentRoutes, { prefix: "/apartments" });
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Smoke test — full instantiation flow (server running)**

```bash
# Setup: you need a building (id:1) and apartment type with rooms (id:1 with rooms)
# from Tasks 1 and 2 smoke tests. Re-create if needed.

# 1. Create apartment (triggers instantiation)
curl -s -X POST http://localhost:3333/apartments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"buildingId":1,"apartmentTypeId":1,"identifier":"101","floor":1,"block":"A"}'
# Expected: 201 + apartment with rooms array populated from type template

# 2. List apartments filtered by building
curl -s "http://localhost:3333/apartments?buildingId=1" \
  -H "Authorization: Bearer <token>"
# Expected: 200 + array with apartment 101

# 3. Get apartment detail
curl -s http://localhost:3333/apartments/1 \
  -H "Authorization: Bearer <token>"
# Expected: 200 + apartment with rooms + services per room (empty for now)

# 4. Rename a room (use the roomId from the detail response)
curl -s -X PATCH http://localhost:3333/apartments/1/rooms/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Suite Master"}'
# Expected: 200 + updated room

# 5. Duplicate identifier check
curl -s -X POST http://localhost:3333/apartments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"buildingId":1,"apartmentTypeId":1,"identifier":"101"}'
# Expected: 409

# 6. Invalid building check
curl -s -X POST http://localhost:3333/apartments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"buildingId":999,"apartmentTypeId":1,"identifier":"102"}'
# Expected: 404 "Building not found."

# 7. Delete apartment
curl -s -X DELETE http://localhost:3333/apartments/1 \
  -H "Authorization: Bearer <token>"
# Expected: 204
```

- [ ] **Step 9: Final build check**

```bash
npm run build
```

Expected: compiles to `./dist` with no errors.

- [ ] **Step 10: Commit**

```bash
git add src/modules/apartment/ src/main/app.ts
git commit -m "feat(apartment): add CRUD module with type instantiation and room/service sub-routes"
```

---

## Self-Review Checklist

- [x] **Schema coverage:** `prisma/schema.prisma` covers all 6 entities from spec. `@@map`, `@map`, `@db.VarChar` conventions followed.
- [x] **Permissions:** `apartment-types:*` added to catalog. `buildings:*` and `apartments:*` already existed.
- [x] **Instantiation flow:** `createWithRooms` uses `prisma.$transaction`, copies rooms from type, no services (Spec 2).
- [x] **`onDelete: SetNull`:** `ApartmentRoom.roomId` is nullable — Room template deletion doesn't break instances.
- [x] **`exactOptionalPropertyTypes`:** All optional field writes use `...(x !== undefined && { field: x })` spread pattern.
- [x] **`verbatimModuleSyntax`:** Controller and schema files use `import type` for type-only imports.
- [x] **Business rules:** All 7 error cases from spec have explicit guards in service layer.
- [x] **Unique constraint name:** `@@unique([buildingId, identifier])` → Prisma names it `buildingId_identifier` — used correctly in `findByBuildingAndIdentifier`.
- [x] **Service stub:** `Service` model is minimal (id + name) — `ApartmentRoomService` FK is valid. Spec 2 expands it.
- [x] **Inspection dormant:** `Inspection` model kept with basic fields, broken relations removed.
