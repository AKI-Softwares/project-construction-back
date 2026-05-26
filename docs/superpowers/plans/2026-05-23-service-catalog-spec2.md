# Spec 2 — Service Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the global service catalog (Service CRUD), room default services (RoomDefaultService junction), and update apartment instantiation to auto-populate services from room templates.

**Architecture:** New `service` module with full CRUD at `/services`; `apartment-type` module extended with 3 sub-routes managing `RoomDefaultService`; `apartment.repository.ts` updated so `POST /apartments` copies default services into the new apartment in the same transaction. No new module for the junction table — kept inside `apartment-type` for consistency with the existing nested-route pattern.

**Tech Stack:** Fastify v5, Prisma v6 + PostgreSQL (Neon), Zod v4, TypeScript ESM (`.js` imports)

---

## File Map

**Create:**
- `src/modules/service/service.schema.ts`
- `src/modules/service/service.repository.ts`
- `src/modules/service/service.service.ts`
- `src/modules/service/service.controller.ts`
- `src/modules/service/service.routes.ts`

**Modify:**
- `prisma/schema.prisma` — expand `Service`, add `RoomDefaultService`, add relation to `Room`
- `src/main/app.ts` — register `serviceRoutes`
- `src/modules/apartment-type/apartment-type.schema.ts` — add `roomServiceParamsSchema`, `addRoomDefaultServiceSchema`
- `src/modules/apartment-type/apartment-type.repository.ts` — add 5 methods for `RoomDefaultService`
- `src/modules/apartment-type/apartment-type.service.ts` — add 3 methods
- `src/modules/apartment-type/apartment-type.controller.ts` — add 3 handlers
- `src/modules/apartment-type/apartment-type.routes.ts` — add 3 routes
- `src/modules/apartment/apartment.repository.ts` — update `findApartmentTypeWithRooms` + `createWithRooms`

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `Service` model**

In `prisma/schema.prisma`, replace the existing `Service` model with:

```prisma
model Service {
  id                    Int                    @id @default(autoincrement())
  name                  String                 @unique @db.VarChar(255)
  description           String?                @db.VarChar(500)
  category              String?                @db.VarChar(100)
  createdAt             DateTime               @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  apartmentRoomServices ApartmentRoomService[]
  roomDefaultServices   RoomDefaultService[]

  @@map("Service")
}
```

- [ ] **Step 2: Add `defaultServices` relation to `Room` model**

In the `Room` model, add the relation field after `apartmentRooms`:

```prisma
  apartmentRooms  ApartmentRoom[]
  defaultServices RoomDefaultService[]
```

- [ ] **Step 3: Add `RoomDefaultService` model**

Append after the `Service` model (before `Inspection`):

```prisma
model RoomDefaultService {
  roomId    Int     @map("room_id")
  serviceId Int     @map("service_id")
  room      Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@id([roomId, serviceId])
  @@index([serviceId])
  @@map("RoomDefaultService")
}
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name spec2-service-catalog
```

Expected: migration file created under `prisma/migrations/`, applied to DB, Prisma client regenerated.

- [ ] **Step 5: Run seed to sync permissions and role assignments**

`services:*` already exists in `src/shared/rbac/permissions.catalog.ts`. Re-running the seed upserts all catalog permissions and assigns them to Administrator.

```bash
npm run db:seed
```

Expected output: `Permissions: 33 upserted` (or similar count including the 4 services:* permissions).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add RoomDefaultService, expand Service for Spec 2"
```

---

## Task 2: Module `service` — 5 files + register in app.ts

**Files:**
- Create: `src/modules/service/service.schema.ts`
- Create: `src/modules/service/service.repository.ts`
- Create: `src/modules/service/service.service.ts`
- Create: `src/modules/service/service.controller.ts`
- Create: `src/modules/service/service.routes.ts`
- Modify: `src/main/app.ts`

- [ ] **Step 1: Create `src/modules/service/service.schema.ts`**

```ts
import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const serviceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const serviceQuerySchema = z.object({
  category: z.string().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceParams = z.infer<typeof serviceParamsSchema>;
export type ServiceQuery = z.infer<typeof serviceQuerySchema>;
```

- [ ] **Step 2: Create `src/modules/service/service.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { CreateServiceInput, UpdateServiceInput } from "./service.schema.js";

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ServiceRepository {
  async findAll(category?: string) {
    return prisma.service.findMany({
      ...(category !== undefined && {
        where: { category: { equals: category, mode: "insensitive" } },
      }),
      select: SERVICE_SELECT,
      orderBy: { name: "asc" as const },
    });
  }

  async findById(id: number) {
    return prisma.service.findUnique({ where: { id }, select: SERVICE_SELECT });
  }

  async findByName(name: string) {
    return prisma.service.findUnique({ where: { name }, select: { id: true } });
  }

  async create(data: CreateServiceInput) {
    return prisma.service.create({
      data: {
        name: data.name,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async update(id: number, data: UpdateServiceInput) {
    return prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
      },
      select: SERVICE_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.service.delete({ where: { id }, select: { id: true } });
  }

  async countApartmentRoomServices(id: number) {
    return prisma.apartmentRoomService.count({ where: { serviceId: id } });
  }

  async countRoomDefaultServices(id: number) {
    return prisma.roomDefaultService.count({ where: { serviceId: id } });
  }
}
```

- [ ] **Step 3: Create `src/modules/service/service.service.ts`**

```ts
import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ServiceRepository } from "./service.repository.js";
import type { CreateServiceInput, UpdateServiceInput } from "./service.schema.js";

export class ServiceService {
  constructor(private readonly repo: ServiceRepository) {}

  async listServices(category?: string) {
    return this.repo.findAll(category);
  }

  async getService(id: number) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    return service;
  }

  async createService(input: CreateServiceInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) throw new HttpError(409, "Service name already exists.");
    try {
      return await this.repo.create(input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async updateService(id: number, input: UpdateServiceInput) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    if (input.name !== undefined && input.name !== service.name) {
      const existing = await this.repo.findByName(input.name);
      if (existing) throw new HttpError(409, "Service name already exists.");
    }
    try {
      return await this.repo.update(id, input);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service name already exists.");
      }
      throw e;
    }
  }

  async deleteService(id: number) {
    const service = await this.repo.findById(id);
    if (!service) throw new HttpError(404, "Service not found.");
    const instanceCount = await this.repo.countApartmentRoomServices(id);
    if (instanceCount > 0) {
      throw new HttpError(409, "Service is in use by apartment instances and cannot be deleted.");
    }
    const defaultCount = await this.repo.countRoomDefaultServices(id);
    if (defaultCount > 0) {
      throw new HttpError(409, "Service is set as a room default and cannot be deleted.");
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Create `src/modules/service/service.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ServiceService } from "./service.service.js";
import type {
  CreateServiceInput,
  ServiceParams,
  ServiceQuery,
  UpdateServiceInput,
} from "./service.schema.js";

export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  async list(request: FastifyRequest<{ Querystring: ServiceQuery }>, reply: FastifyReply) {
    return reply.send(await this.service.listServices(request.query.category));
  }

  async getOne(request: FastifyRequest<{ Params: ServiceParams }>, reply: FastifyReply) {
    return reply.send(await this.service.getService(request.params.id));
  }

  async create(request: FastifyRequest<{ Body: CreateServiceInput }>, reply: FastifyReply) {
    return reply.status(201).send(await this.service.createService(request.body));
  }

  async update(
    request: FastifyRequest<{ Params: ServiceParams; Body: UpdateServiceInput }>,
    reply: FastifyReply,
  ) {
    return reply.send(await this.service.updateService(request.params.id, request.body));
  }

  async remove(request: FastifyRequest<{ Params: ServiceParams }>, reply: FastifyReply) {
    await this.service.deleteService(request.params.id);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `src/modules/service/service.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ServiceRepository } from "./service.repository.js";
import { ServiceService } from "./service.service.js";
import { ServiceController } from "./service.controller.js";
import {
  createServiceSchema,
  serviceParamsSchema,
  serviceQuerySchema,
  updateServiceSchema,
} from "./service.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const serviceRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new ServiceRepository();
  const service = new ServiceService(repo);
  const controller = new ServiceController(service);

  app.get(
    "/",
    {
      schema: { querystring: serviceQuerySchema },
      preHandler: [app.authenticate, checkPermission("services:read")],
    },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: serviceParamsSchema },
      preHandler: [app.authenticate, checkPermission("services:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createServiceSchema },
      preHandler: [app.authenticate, checkPermission("services:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: serviceParamsSchema, body: updateServiceSchema },
      preHandler: [app.authenticate, checkPermission("services:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: serviceParamsSchema },
      preHandler: [app.authenticate, checkPermission("services:delete")],
    },
    controller.remove.bind(controller),
  );
};
```

- [ ] **Step 6: Register in `src/main/app.ts`**

Add import after the `apartmentRoutes` import line:

```ts
import { serviceRoutes } from "../modules/service/service.routes.js";
```

Add registration after `apartmentRoutes` registration:

```ts
  await app.register(serviceRoutes, { prefix: "/services" });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 8: Smoke test `service` endpoints**

Start the dev server: `npm run dev`

Replace `TOKEN` with a valid JWT for the Administrator role.

```bash
# Create
curl -X POST http://localhost:3000/services \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Pintura interna", "category": "Acabamento"}'
# Expected: 201 { "id": N, "name": "Pintura interna", "description": null, "category": "Acabamento", ... }

# List all
curl http://localhost:3000/services \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 [ { "id": N, ... } ]

# Filter (case-insensitive)
curl "http://localhost:3000/services?category=acabamento" \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 [ { "id": N, "category": "Acabamento", ... } ]

# Get by id
curl http://localhost:3000/services/N \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 { "id": N, ... }

# Update
curl -X PATCH http://localhost:3000/services/N \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Pintura de paredes e teto"}'
# Expected: 200 { "id": N, "description": "Pintura de paredes e teto", ... }

# Delete (no references yet, should succeed)
curl -X DELETE http://localhost:3000/services/N \
  -H "Authorization: Bearer TOKEN"
# Expected: 204
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/service/ src/main/app.ts
git commit -m "feat(service): CRUD module at /services with category filter"
```

---

## Task 3: Extend `apartment-type` — RoomDefaultService sub-routes

**Files:**
- Modify: `src/modules/apartment-type/apartment-type.schema.ts`
- Modify: `src/modules/apartment-type/apartment-type.repository.ts`
- Modify: `src/modules/apartment-type/apartment-type.service.ts`
- Modify: `src/modules/apartment-type/apartment-type.controller.ts`
- Modify: `src/modules/apartment-type/apartment-type.routes.ts`

- [ ] **Step 1: Update `apartment-type.schema.ts`**

Append to the end of the file (before the closing):

```ts
export const roomServiceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
});

export const addRoomDefaultServiceSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
});

export type RoomServiceParams = z.infer<typeof roomServiceParamsSchema>;
export type AddRoomDefaultServiceInput = z.infer<typeof addRoomDefaultServiceSchema>;
```

- [ ] **Step 2: Update `apartment-type.repository.ts`**

Add the select constant before the class declaration:

```ts
const ROOM_DEFAULT_SERVICE_SELECT = {
  serviceId: true,
  service: { select: { id: true, name: true, category: true } },
} as const;
```

Add these 5 methods inside `ApartmentTypeRepository`, after `deleteRoom`:

```ts
  async listRoomDefaultServices(roomId: number) {
    return prisma.roomDefaultService.findMany({
      where: { roomId },
      select: ROOM_DEFAULT_SERVICE_SELECT,
      orderBy: { service: { name: "asc" } },
    });
  }

  async findService(serviceId: number) {
    return prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
  }

  async findRoomDefaultService(roomId: number, serviceId: number) {
    return prisma.roomDefaultService.findUnique({
      where: { roomId_serviceId: { roomId, serviceId } },
      select: { serviceId: true },
    });
  }

  async addRoomDefaultService(roomId: number, serviceId: number) {
    return prisma.roomDefaultService.create({
      data: { roomId, serviceId },
      select: ROOM_DEFAULT_SERVICE_SELECT,
    });
  }

  async deleteRoomDefaultService(roomId: number, serviceId: number) {
    return prisma.roomDefaultService.delete({
      where: { roomId_serviceId: { roomId, serviceId } },
      select: { serviceId: true },
    });
  }
```

- [ ] **Step 3: Update `apartment-type.service.ts`**

Update the import from `./apartment-type.schema.js` to include new types:

```ts
import type {
  AddRoomDefaultServiceInput,
  CreateApartmentTypeInput,
  CreateRoomInput,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";
```

Add 3 methods inside `ApartmentTypeService`, after `removeRoom`:

```ts
  async listRoomDefaultServices(apartmentTypeId: number, roomId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    return this.repo.listRoomDefaultServices(roomId);
  }

  async addRoomDefaultService(
    apartmentTypeId: number,
    roomId: number,
    input: AddRoomDefaultServiceInput,
  ) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    const service = await this.repo.findService(input.serviceId);
    if (!service) throw new HttpError(404, "Service not found.");
    const existing = await this.repo.findRoomDefaultService(roomId, input.serviceId);
    if (existing) throw new HttpError(409, "Service already set as default for this room.");
    try {
      return await this.repo.addRoomDefaultService(roomId, input.serviceId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Service already set as default for this room.");
      }
      throw e;
    }
  }

  async removeRoomDefaultService(apartmentTypeId: number, roomId: number, serviceId: number) {
    const type = await this.repo.findById(apartmentTypeId);
    if (!type) throw new HttpError(404, "Apartment type not found.");
    const room = await this.repo.findRoom(apartmentTypeId, roomId);
    if (!room) throw new HttpError(404, "Room not found in this apartment type.");
    const link = await this.repo.findRoomDefaultService(roomId, serviceId);
    if (!link) throw new HttpError(404, "Service not set as default for this room.");
    await this.repo.deleteRoomDefaultService(roomId, serviceId);
  }
```

- [ ] **Step 4: Update `apartment-type.controller.ts`**

Update the import from `./apartment-type.schema.js` to include new types:

```ts
import type {
  AddRoomDefaultServiceInput,
  ApartmentTypeParams,
  CreateApartmentTypeInput,
  CreateRoomInput,
  RoomParams,
  RoomServiceParams,
  UpdateApartmentTypeInput,
} from "./apartment-type.schema.js";
```

Add 3 handlers inside `ApartmentTypeController`, after `removeRoom`:

```ts
  async listRoomDefaultServices(
    request: FastifyRequest<{ Params: RoomParams }>,
    reply: FastifyReply,
  ) {
    return reply.send(
      await this.service.listRoomDefaultServices(request.params.id, request.params.roomId),
    );
  }

  async addRoomDefaultService(
    request: FastifyRequest<{ Params: RoomParams; Body: AddRoomDefaultServiceInput }>,
    reply: FastifyReply,
  ) {
    return reply.status(201).send(
      await this.service.addRoomDefaultService(
        request.params.id,
        request.params.roomId,
        request.body,
      ),
    );
  }

  async removeRoomDefaultService(
    request: FastifyRequest<{ Params: RoomServiceParams }>,
    reply: FastifyReply,
  ) {
    await this.service.removeRoomDefaultService(
      request.params.id,
      request.params.roomId,
      request.params.serviceId,
    );
    return reply.status(204).send();
  }
```

- [ ] **Step 5: Update `apartment-type.routes.ts`**

Update the schema import to include new exports:

```ts
import {
  addRoomDefaultServiceSchema,
  apartmentTypeParamsSchema,
  createApartmentTypeSchema,
  createRoomSchema,
  roomParamsSchema,
  roomServiceParamsSchema,
  updateApartmentTypeSchema,
} from "./apartment-type.schema.js";
```

Add 3 routes after the existing `app.delete("/:id/rooms/:roomId", ...)` block:

```ts
  app.get(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: roomParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:read")],
    },
    controller.listRoomDefaultServices.bind(controller),
  );

  app.post(
    "/:id/rooms/:roomId/services",
    {
      schema: { params: roomParamsSchema, body: addRoomDefaultServiceSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.addRoomDefaultService.bind(controller),
  );

  app.delete(
    "/:id/rooms/:roomId/services/:serviceId",
    {
      schema: { params: roomServiceParamsSchema },
      preHandler: [app.authenticate, checkPermission("apartment-types:update")],
    },
    controller.removeRoomDefaultService.bind(controller),
  );
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Smoke test RoomDefaultService sub-routes**

Use an existing `apartmentTypeId` and `roomId` from your DB. Create a service first if needed (use the serviceId from Task 2 tests, or create another).

```bash
# Associate service as default for room (replace 1/1/1 with real IDs)
curl -X POST http://localhost:3000/apartment-types/1/rooms/1/services \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 1}'
# Expected: 201 { "serviceId": 1, "service": { "id": 1, "name": "...", "category": "..." } }

# Duplicate → 409
curl -X POST http://localhost:3000/apartment-types/1/rooms/1/services \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 1}'
# Expected: 409 { "message": "Service already set as default for this room." }

# List
curl http://localhost:3000/apartment-types/1/rooms/1/services \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 [ { "serviceId": 1, "service": { ... } } ]

# Remove
curl -X DELETE http://localhost:3000/apartment-types/1/rooms/1/services/1 \
  -H "Authorization: Bearer TOKEN"
# Expected: 204

# List again — empty
curl http://localhost:3000/apartment-types/1/rooms/1/services \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 []
```

- [ ] **Step 8: Commit**

```bash
git add src/modules/apartment-type/
git commit -m "feat(apartment-type): add RoomDefaultService sub-routes for room template services"
```

---

## Task 4: Update `POST /apartments` transaction to copy services

**Files:**
- Modify: `src/modules/apartment/apartment.repository.ts`

- [ ] **Step 1: Update `findApartmentTypeWithRooms`**

Replace the existing method body:

```ts
  async findApartmentTypeWithRooms(id: number) {
    return prisma.apartmentType.findUnique({
      where: { id },
      select: {
        id: true,
        rooms: {
          select: {
            id: true,
            name: true,
            defaultServices: { select: { serviceId: true } },
          },
        },
      },
    });
  }
```

- [ ] **Step 2: Update `createWithRooms`**

Replace the existing method signature and body:

```ts
  async createWithRooms(
    input: CreateApartmentInput,
    rooms: { id: number; name: string; defaultServices: { serviceId: number }[] }[],
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

      const createdRooms: { id: number }[] = [];
      for (const room of rooms) {
        const created = await tx.apartmentRoom.create({
          data: { apartmentId: apartment.id, roomId: room.id, name: room.name },
          select: { id: true },
        });
        createdRooms.push(created);
      }

      const serviceData = createdRooms.flatMap((createdRoom, i) =>
        rooms[i].defaultServices.map((ds) => ({
          apartmentRoomId: createdRoom.id,
          serviceId: ds.serviceId,
        })),
      );

      if (serviceData.length > 0) {
        await tx.apartmentRoomService.createMany({ data: serviceData });
      }

      const result = await tx.apartment.findUnique({
        where: { id: apartment.id },
        select: APARTMENT_DETAIL_SELECT,
      });

      return result!;
    });
  }
```

Note: switched from `createMany` to individual `create` calls in a loop to get back `ApartmentRoom.id` values needed to link services. `apartment.service.ts` requires no changes — TypeScript structural typing handles the updated return type of `findApartmentTypeWithRooms` automatically.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: End-to-end test instantiation**

Set up a type with a room that has a default service, then instantiate an apartment.

```bash
# 1. Create apartment type
curl -X POST http://localhost:3000/apartment-types \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tipo Spec2 Test"}'
# Note id → TYPE_ID

# 2. Add a room to the type
curl -X POST http://localhost:3000/apartment-types/TYPE_ID/rooms \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sala"}'
# Note id → ROOM_ID

# 3. Create a service
curl -X POST http://localhost:3000/services \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tomada elétrica", "category": "Elétrica"}'
# Note id → SERVICE_ID

# 4. Associate service as default for room
curl -X POST http://localhost:3000/apartment-types/TYPE_ID/rooms/ROOM_ID/services \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceId": SERVICE_ID}'
# Expected: 201

# 5. Instantiate apartment (use an existing BUILDING_ID)
curl -X POST http://localhost:3000/apartments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"buildingId": BUILDING_ID, "apartmentTypeId": TYPE_ID, "identifier": "S2-TEST"}'
# Expected: 201, response contains rooms[0].services = [{ serviceId: SERVICE_ID, service: { ... } }]
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/apartment/apartment.repository.ts
git commit -m "feat(apartment): copy RoomDefaultService into ApartmentRoomService on instantiation"
```

---

## Task 5: Update Insomnia Collection

**Files:**
- Modify: Insomnia collection file (find with `git ls-files | grep -i insomnia`)

- [ ] **Step 1: Add `Services` folder with CRUD requests**

Add for each environment (Local/Dev/Prod):
- `GET /services` — include `category` query param (optional)
- `GET /services/:id`
- `POST /services` — body: `{ "name": "", "description": "", "category": "" }`
- `PATCH /services/:id` — body: `{ "name": "", "description": "", "category": "" }`
- `DELETE /services/:id`

- [ ] **Step 2: Add RoomDefaultService requests to `Apartment Types` folder**

- `GET /apartment-types/:id/rooms/:roomId/services`
- `POST /apartment-types/:id/rooms/:roomId/services` — body: `{ "serviceId": 1 }`
- `DELETE /apartment-types/:id/rooms/:roomId/services/:serviceId`

- [ ] **Step 3: Commit**

```bash
git add <insomnia-collection-file>
git commit -m "chore(insomnia): add Services and RoomDefaultService requests"
```
