# Permissions & RBAC Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace role-name authorization with permission-based authorization. Introduce a permission catalog (seeded from code), dynamic role CRUD, JWT payload migration, and refactor every existing call site.

**Architecture:** Two new modules (`permission`, `role`) following the fractal-modular pattern. A `checkPermission(...actions)` factory replaces `checkRole(...)`. The permission catalog is defined in code and seeded into a `Permission` table; the `Role ↔ Permission` relation becomes Prisma implicit M:N. JWT payload changes from `{ sub, role }` to `{ sub, roleId, permissions: string[] }`, snapshotted at login. The legacy `Role` enum and `checkRole` factory are deleted in the same PR (clean break, no compat layer).

**Tech Stack:** Node.js + TypeScript (ESM, NodeNext), Fastify v5, Prisma v6 + PostgreSQL (Neon), Zod v4, `@fastify/jwt`, bcrypt.

**Verification model:** This project has no automated test suite. Each task verifies via:
- `npx tsc --noEmit` (type check — primary "compile-time test")
- `npm run build` (full build sanity)
- Prisma generate + migrate where schema changes
- Manual smoke via Insomnia / `curl` at end of route-touching tasks

When a step says "verify", run the indicated command and confirm the **expected output** before checking the box.

**Spec reference:** `docs/superpowers/specs/2026-05-22-permissions-and-rbac-design.md`

---

### Task 1: Update Prisma schema for Permission + Role M:N

**Files:**
- Modify: `prisma/schema.prisma:26-42`

- [ ] **Step 1: Open `prisma/schema.prisma` and replace the `Role` and `Permissions` models**

Replace the existing block (lines 26-42, the `model Role` and `model Permissions`) with:

```prisma
model Role {
  id          Int          @id @default(autoincrement())
  name        String       @unique @db.VarChar(255)
  description String?      @db.VarChar(500)
  isSystem    Boolean      @default(false) @map("is_system")
  permissions Permission[] @relation("RolePermissions")
  users       User[]
  createdAt   DateTime?    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime?    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("Role")
}

model Permission {
  id        Int    @id @default(autoincrement())
  action    String @unique @db.VarChar(100)
  resource  String @db.VarChar(50)
  operation String @db.VarChar(50)
  roles     Role[] @relation("RolePermissions")

  @@map("Permission")
}
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:migrate -- --name add_permission_catalog_and_role_perms`

Expected: Prisma prompts about data loss for `Permissions` table and `Role.permissionsId` column. Confirm yes.

Migration applies, prisma client regenerates. Check that `prisma/migrations/<timestamp>_add_permission_catalog_and_role_perms/migration.sql` exists.

- [ ] **Step 3: Verify generated client**

Run: `npx tsc --noEmit`

Expected: PASS (existing code that referenced `prisma.permissions` will now fail — but no such reference exists in the codebase today; if any compile error surfaces here, stop and report).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(rbac): replace Permissions N:1 with Role-Permission M:N + isSystem flag"
```

---

### Task 2: Create permission catalog

**Files:**
- Create: `src/shared/rbac/permissions.catalog.ts`

- [ ] **Step 1: Create the catalog file**

```ts
export const PERMISSIONS = [
  { action: "users:read",          resource: "users",          operation: "read"   },
  { action: "users:create",        resource: "users",          operation: "create" },
  { action: "users:update",        resource: "users",          operation: "update" },
  { action: "users:delete",        resource: "users",          operation: "delete" },

  { action: "roles:read",          resource: "roles",          operation: "read"   },
  { action: "roles:create",        resource: "roles",          operation: "create" },
  { action: "roles:update",        resource: "roles",          operation: "update" },
  { action: "roles:delete",        resource: "roles",          operation: "delete" },

  { action: "permissions:read",    resource: "permissions",    operation: "read"   },

  { action: "buildings:read",      resource: "buildings",      operation: "read"   },
  { action: "buildings:create",    resource: "buildings",      operation: "create" },
  { action: "buildings:update",    resource: "buildings",      operation: "update" },
  { action: "buildings:delete",    resource: "buildings",      operation: "delete" },

  { action: "apartments:read",     resource: "apartments",     operation: "read"   },
  { action: "apartments:create",   resource: "apartments",     operation: "create" },
  { action: "apartments:update",   resource: "apartments",     operation: "update" },
  { action: "apartments:delete",   resource: "apartments",     operation: "delete" },

  { action: "dependencies:read",   resource: "dependencies",   operation: "read"   },
  { action: "dependencies:create", resource: "dependencies",   operation: "create" },
  { action: "dependencies:update", resource: "dependencies",   operation: "update" },
  { action: "dependencies:delete", resource: "dependencies",   operation: "delete" },

  { action: "services:read",       resource: "services",       operation: "read"   },
  { action: "services:create",     resource: "services",       operation: "create" },
  { action: "services:update",     resource: "services",       operation: "update" },
  { action: "services:delete",     resource: "services",       operation: "delete" },

  { action: "checklists:read",     resource: "checklists",     operation: "read"   },
  { action: "checklists:create",   resource: "checklists",     operation: "create" },
  { action: "checklists:update",   resource: "checklists",     operation: "update" },
  { action: "checklists:delete",   resource: "checklists",     operation: "delete" },
  { action: "checklists:sign",     resource: "checklists",     operation: "sign"   },

  { action: "inspections:read",    resource: "inspections",    operation: "read"   },
  { action: "inspections:create",  resource: "inspections",    operation: "create" },
  { action: "inspections:update",  resource: "inspections",    operation: "update" },
  { action: "inspections:delete",  resource: "inspections",    operation: "delete" },
] as const;

export type PermissionAction = (typeof PERMISSIONS)[number]["action"];
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit`

Expected: PASS. `PermissionAction` should resolve to a union of all literal action strings.

- [ ] **Step 3: Commit**

```bash
git add src/shared/rbac/permissions.catalog.ts
git commit -m "feat(rbac): add permission catalog as code-defined source of truth"
```

---

### Task 3: Replace seed with catalog + Administrator role bootstrap

**Files:**
- Modify: `prisma/seed.ts` (full rewrite)

- [ ] **Step 1: Overwrite `prisma/seed.ts`**

```ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import { PERMISSIONS } from "../src/shared/rbac/permissions.catalog.js";

const SUPER_ADMIN_EMAIL = "super-admin@aki.com.br";
const SUPER_ADMIN_NAME = "Super Admin";
const DEFAULT_PASSWORD = "Aki@SuperAdmin#2026";
const ADMIN_ROLE_NAME = "Administrator";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not defined in .env");
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Upsert permission catalog
    for (const p of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { action: p.action },
        update: { resource: p.resource, operation: p.operation },
        create: p,
      });
    }
    const allPerms = await prisma.permission.findMany({ select: { id: true } });

    // 2. Upsert Administrator role connected to all permissions
    const adminRole = await prisma.role.upsert({
      where: { name: ADMIN_ROLE_NAME },
      update: {
        isSystem: true,
        description: "Full access to all resources.",
        permissions: { set: allPerms.map((p) => ({ id: p.id })) },
      },
      create: {
        name: ADMIN_ROLE_NAME,
        isSystem: true,
        description: "Full access to all resources.",
        permissions: { connect: allPerms.map((p) => ({ id: p.id })) },
      },
    });

    // 3. Upsert super-admin user
    const password = process.env.SUPER_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
    const usingDefault = !process.env.SUPER_ADMIN_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email: SUPER_ADMIN_EMAIL },
      update: { roleId: adminRole.id, passwordHash, name: SUPER_ADMIN_NAME },
      create: {
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        roleId: adminRole.id,
      },
    });

    console.log("\n=== Seed complete ===");
    console.log(`Permissions: ${allPerms.length} upserted`);
    console.log(`Role:        ${ADMIN_ROLE_NAME} (id=${adminRole.id}) with all permissions`);
    console.log(`User:        ${user.email} (id=${user.id})`);
    console.log(
      `Password:    ${password}${usingDefault ? "  [default — set SUPER_ADMIN_PASSWORD to override]" : "  [from env]"}`,
    );
    console.log("=====================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`

Expected output includes:
```
=== Seed complete ===
Permissions: 33 upserted
Role:        Administrator (id=...) with all permissions
User:        super-admin@aki.com.br (id=...)
```

If the existing DB had a different role linked to the super-admin (e.g. legacy "ADMIN"), the super-admin user is now reassigned to the new `Administrator` role. The legacy role row remains (no users on it after this) and is harmless. Optionally clean up later via PATCH/DELETE through the new `/roles` API.

- [ ] **Step 3: Verify in DB**

Run: `npx prisma studio` (opens at http://localhost:5555). Inspect:
- `Permission` table: 33 rows
- `Role` table: row `Administrator`, `isSystem = true`
- `_RolePermissions` join: 33 rows for the Administrator role

Close studio when done.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): bootstrap Administrator role with full permission catalog"
```

---

### Task 4: Update JWT type augmentation

**Files:**
- Modify: `src/shared/types/fastify.d.ts`

- [ ] **Step 1: Replace contents of `src/shared/types/fastify.d.ts`**

```ts
import "@fastify/jwt";
import "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      roleId: number;
      permissions: string[];
    };
    user: {
      sub: string;
      roleId: number;
      permissions: string[];
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>;
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

Expected: FAIL with multiple errors in `auth.service.ts`, `auth.controller.ts`, `user.controller.ts`, `user.service.ts` because they still reference `request.user.role` (string). This is intentional — these will be fixed in later tasks. Note the error count so you can confirm it drops to zero after Tasks 7-9.

- [ ] **Step 3: Do NOT commit yet** — leave staged for the auth refactor commit. Move on.

---

### Task 5: Create `checkPermission` factory

**Files:**
- Create: `src/shared/rbac/check-permission.ts`

- [ ] **Step 1: Create the file**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../errors/http-error.js";
import type { PermissionAction } from "./permissions.catalog.js";

/**
 * Factory de preHandler para autorização por permissão.
 *
 * Semântica AND: requer TODAS as permissões listadas.
 *   preHandler: [app.authenticate, checkPermission("users:update")]
 *   preHandler: [app.authenticate, checkPermission("roles:create", "permissions:read")]
 */
export function checkPermission(...required: PermissionAction[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const userPerms = request.user?.permissions ?? [];
    const hasAll = required.every((p) => userPerms.includes(p));
    if (!hasAll) {
      throw new HttpError(403, "Access denied: insufficient permissions.");
    }
  };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

Expected: `check-permission.ts` itself compiles clean. Pre-existing errors from Task 4 are still present.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/fastify.d.ts src/shared/rbac/check-permission.ts
git commit -m "feat(rbac): add checkPermission factory + JWT payload type"
```

---

### Task 6: Build `permission` module (read-only)

**Files:**
- Create: `src/modules/permission/permission.schema.ts`
- Create: `src/modules/permission/permission.repository.ts`
- Create: `src/modules/permission/permission.service.ts`
- Create: `src/modules/permission/permission.controller.ts`
- Create: `src/modules/permission/permission.routes.ts`

- [ ] **Step 1: Create `permission.schema.ts`**

```ts
import { z } from "zod";

export const permissionResponseSchema = z.array(
  z.object({
    resource: z.string(),
    permissions: z.array(
      z.object({
        id: z.number(),
        action: z.string(),
        operation: z.string(),
      }),
    ),
  }),
);

export type PermissionGroup = z.infer<typeof permissionResponseSchema>[number];
```

- [ ] **Step 2: Create `permission.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";
import type { PermissionGroup } from "./permission.schema.js";

export class PermissionRepository {
  async findAllGroupedByResource(): Promise<PermissionGroup[]> {
    const rows = await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { operation: "asc" }],
      select: { id: true, action: true, resource: true, operation: true },
    });

    const groups = new Map<string, PermissionGroup>();
    for (const row of rows) {
      if (!groups.has(row.resource)) {
        groups.set(row.resource, { resource: row.resource, permissions: [] });
      }
      groups.get(row.resource)!.permissions.push({
        id: row.id,
        action: row.action,
        operation: row.operation,
      });
    }
    return Array.from(groups.values());
  }
}
```

- [ ] **Step 3: Create `permission.service.ts`**

```ts
import type { PermissionRepository } from "./permission.repository.js";

export class PermissionService {
  constructor(private readonly repo: PermissionRepository) {}

  async listGrouped() {
    return this.repo.findAllGroupedByResource();
  }
}
```

- [ ] **Step 4: Create `permission.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PermissionService } from "./permission.service.js";

export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const groups = await this.service.listGrouped();
    return reply.send(groups);
  }
}
```

- [ ] **Step 5: Create `permission.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { PermissionRepository } from "./permission.repository.js";
import { PermissionService } from "./permission.service.js";
import { PermissionController } from "./permission.controller.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const permissionRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new PermissionRepository();
  const service = new PermissionService(repo);
  const controller = new PermissionController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("permissions:read")] },
    controller.list.bind(controller),
  );
};
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`

Expected: `src/modules/permission/**` compiles clean. Pre-existing user/auth errors from Task 4 still present.

- [ ] **Step 7: Commit**

```bash
git add src/modules/permission/
git commit -m "feat(permission): add read-only module exposing catalog grouped by resource"
```

---

### Task 7: Build `role` module (CRUD)

**Files:**
- Create: `src/modules/role/role.schema.ts`
- Create: `src/modules/role/role.repository.ts`
- Create: `src/modules/role/role.service.ts`
- Create: `src/modules/role/role.controller.ts`
- Create: `src/modules/role/role.routes.ts`

- [ ] **Step 1: Create `role.schema.ts`**

```ts
import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.number().int().positive()).min(1),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionIds: z.array(z.number().int().positive()).optional(),
});

export const roleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleParams = z.infer<typeof roleParamsSchema>;
```

- [ ] **Step 2: Create `role.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";

const ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: {
    select: { id: true, action: true, resource: true, operation: true },
  },
  _count: { select: { users: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export class RoleRepository {
  async findAll() {
    return prisma.role.findMany({ select: ROLE_SELECT, orderBy: { name: "asc" } });
  }

  async findById(id: number) {
    return prisma.role.findUnique({ where: { id }, select: ROLE_SELECT });
  }

  async findByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  }

  async create(data: { name: string; description?: string; permissionIds: number[] }) {
    return prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: { connect: data.permissionIds.map((id) => ({ id })) },
      },
      select: ROLE_SELECT,
    });
  }

  async update(
    id: number,
    data: { name?: string; description?: string | null; permissionIds?: number[] },
  ) {
    return prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.permissionIds !== undefined && {
          permissions: { set: data.permissionIds.map((pid) => ({ id: pid })) },
        }),
      },
      select: ROLE_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.role.delete({ where: { id } });
  }

  async findPermissionsByIds(ids: number[]) {
    return prisma.permission.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }
}
```

- [ ] **Step 3: Create `role.service.ts`**

```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { RoleRepository } from "./role.repository.js";
import type { CreateRoleInput, UpdateRoleInput } from "./role.schema.js";

export class RoleService {
  constructor(private readonly repo: RoleRepository) {}

  async listRoles() {
    return this.repo.findAll();
  }

  async getRole(id: number) {
    const role = await this.repo.findById(id);
    if (!role) throw new HttpError(404, "Role not found.");
    return role;
  }

  async createRole(input: CreateRoleInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) throw new HttpError(409, "Role name already exists.");

    await this.assertPermissionsExist(input.permissionIds);

    return this.repo.create({
      name: input.name,
      description: input.description,
      permissionIds: input.permissionIds,
    });
  }

  async updateRole(id: number, input: UpdateRoleInput) {
    const role = await this.repo.findById(id);
    if (!role) throw new HttpError(404, "Role not found.");

    if (input.name && input.name !== role.name) {
      const taken = await this.repo.findByName(input.name);
      if (taken) throw new HttpError(409, "Role name already exists.");
    }

    if (input.permissionIds !== undefined) {
      if (role.isSystem && input.permissionIds.length === 0) {
        throw new HttpError(403, "System role must keep at least one permission.");
      }
      await this.assertPermissionsExist(input.permissionIds);
    }

    return this.repo.update(id, {
      name: input.name,
      description: input.description ?? undefined,
      permissionIds: input.permissionIds,
    });
  }

  async deleteRole(id: number) {
    const role = await this.repo.findById(id);
    if (!role) throw new HttpError(404, "Role not found.");

    if (role.isSystem) {
      throw new HttpError(403, "System role cannot be deleted.");
    }
    if (role._count.users > 0) {
      throw new HttpError(
        409,
        "Role has assigned users. Reassign them before deleting.",
      );
    }

    await this.repo.delete(id);
  }

  private async assertPermissionsExist(ids: number[]) {
    if (ids.length === 0) return;
    const found = await this.repo.findPermissionsByIds(ids);
    const foundIds = new Set(found.map((p) => p.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new HttpError(400, `Invalid permission ids: ${missing.join(",")}`);
    }
  }
}
```

- [ ] **Step 4: Create `role.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RoleService } from "./role.service.js";
import type { CreateRoleInput, UpdateRoleInput, RoleParams } from "./role.schema.js";

export class RoleController {
  constructor(private readonly service: RoleService) {}

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const roles = await this.service.listRoles();
    return reply.send(roles);
  }

  async getOne(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.getRole(request.params.id);
    return reply.send(role);
  }

  async create(
    request: FastifyRequest<{ Body: CreateRoleInput }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.createRole(request.body);
    return reply.status(201).send(role);
  }

  async update(
    request: FastifyRequest<{ Params: RoleParams; Body: UpdateRoleInput }>,
    reply: FastifyReply,
  ) {
    const role = await this.service.updateRole(request.params.id, request.body);
    return reply.send(role);
  }

  async remove(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deleteRole(request.params.id);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 5: Create `role.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { RoleRepository } from "./role.repository.js";
import { RoleService } from "./role.service.js";
import { RoleController } from "./role.controller.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleParamsSchema,
} from "./role.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const roleRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new RoleRepository();
  const service = new RoleService(repo);
  const controller = new RoleController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("roles:read")] },
    controller.list.bind(controller),
  );

  app.get(
    "/:id",
    {
      schema: { params: roleParamsSchema },
      preHandler: [app.authenticate, checkPermission("roles:read")],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createRoleSchema },
      preHandler: [app.authenticate, checkPermission("roles:create")],
    },
    controller.create.bind(controller),
  );

  app.patch(
    "/:id",
    {
      schema: { params: roleParamsSchema, body: updateRoleSchema },
      preHandler: [app.authenticate, checkPermission("roles:update")],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: roleParamsSchema },
      preHandler: [app.authenticate, checkPermission("roles:delete")],
    },
    controller.remove.bind(controller),
  );
};
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`

Expected: `src/modules/role/**` compiles clean. Pre-existing user/auth errors from Task 4 still present.

- [ ] **Step 7: Commit**

```bash
git add src/modules/role/
git commit -m "feat(role): add CRUD module with permission assignment + isSystem protection"
```

---

### Task 8: Update auth flow (repository, service, controller TTL)

**Files:**
- Modify: `src/modules/auth/auth.repository.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/auth/auth.controller.ts:16`

- [ ] **Step 1: Replace `auth.repository.ts`**

```ts
import { prisma } from "../../shared/infra/database/prisma.js";

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: { select: { action: true } },
          },
        },
      },
    });
  }
}
```

- [ ] **Step 2: Replace `auth.service.ts`**

```ts
import bcrypt from "bcrypt";
import { HttpError } from "../../shared/errors/http-error.js";
import type { AuthRepository } from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async login(input: LoginInput) {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new HttpError(401, "Invalid credentials.");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new HttpError(401, "Invalid credentials.");
    }

    const permissions = user.role.permissions.map((p) => p.action);

    return {
      sub: String(user.id),
      roleId: user.roleId,
      permissions,
    };
  }
}
```

- [ ] **Step 3: Update TTL in `auth.controller.ts`**

In `src/modules/auth/auth.controller.ts`, find line 16:

```ts
const token = this.app.jwt.sign(payload, { expiresIn: "7d" });
```

Replace with:

```ts
const token = this.app.jwt.sign(payload, { expiresIn: "1d" });
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`

Expected: auth module errors cleared. Remaining errors should only be in `user.controller.ts` and `user.service.ts` (they still read `request.user.role`).

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/
git commit -m "feat(auth): sign permissions[] into JWT, TTL 1d, EN error messages"
```

---

### Task 9: Refactor user module to permission-based authz

**Files:**
- Modify: `src/modules/user/user.routes.ts`
- Modify: `src/modules/user/user.service.ts`
- Modify: `src/modules/user/user.controller.ts`

- [ ] **Step 1: Replace `user.routes.ts`**

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";
import { UserController } from "./user.controller.js";
import { createUserSchema, updateUserSchema, userParamsSchema } from "./user.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new UserRepository();
  const service = new UserService(repo);
  const controller = new UserController(service);

  app.get(
    "/",
    { preHandler: [app.authenticate, checkPermission("users:read")] },
    controller.list.bind(controller),
  );

  // GET /:id — authenticated only; service enforces self-or-permission rule
  app.get(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate],
    },
    controller.getOne.bind(controller),
  );

  app.post(
    "/",
    {
      schema: { body: createUserSchema },
      preHandler: [app.authenticate, checkPermission("users:create")],
    },
    controller.create.bind(controller),
  );

  // PATCH /:id — authenticated only; service enforces "self OR users:update"
  app.patch(
    "/:id",
    {
      schema: { params: userParamsSchema, body: updateUserSchema },
      preHandler: [app.authenticate],
    },
    controller.update.bind(controller),
  );

  app.delete(
    "/:id",
    {
      schema: { params: userParamsSchema },
      preHandler: [app.authenticate, checkPermission("users:delete")],
    },
    controller.remove.bind(controller),
  );
};
```

- [ ] **Step 2: Replace `user.service.ts`**

```ts
import bcrypt from "bcrypt";
import { HttpError } from "../../shared/errors/http-error.js";
import type { UserRepository } from "./user.repository.js";
import type { CreateUserInput, UpdateUserInput } from "./user.schema.js";

const SALT_ROUNDS = 10;

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async listUsers() {
    return this.repo.findAll();
  }

  async getUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");
    return user;
  }

  async createUser(input: CreateUserInput) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new HttpError(409, "Email already registered.");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.repo.create({ ...input, passwordHash });
  }

  async updateUser(
    id: number,
    input: UpdateUserInput,
    requesterId: number,
    requesterPerms: string[],
  ) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");

    const isSelf = id === requesterId;
    const canUpdateAny = requesterPerms.includes("users:update");

    if (!isSelf && !canUpdateAny) {
      throw new HttpError(403, "Access denied.");
    }

    // Only callers with users:update may change roleId
    if (input.roleId !== undefined && !canUpdateAny) {
      throw new HttpError(403, "Only users with 'users:update' may change role.");
    }

    if (input.email && input.email !== user.email) {
      const emailTaken = await this.repo.findByEmail(input.email);
      if (emailTaken) throw new HttpError(409, "Email already in use.");
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, SALT_ROUNDS)
      : undefined;

    const updateData: UpdateUserInput & { passwordHash?: string } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.roleId !== undefined) updateData.roleId = input.roleId;
    if (passwordHash !== undefined) updateData.passwordHash = passwordHash;

    return this.repo.update(id, updateData);
  }

  async deleteUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new HttpError(404, "User not found.");
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 3: Update `user.controller.ts` update method**

Replace the `update` method body. In `src/modules/user/user.controller.ts`, change:

```ts
async update(
  request: FastifyRequest<{ Params: UserParams; Body: UpdateUserInput }>,
  reply: FastifyReply,
) {
  const requesterId = Number(request.user.sub);
  const requesterRole = request.user.role;

  const user = await this.service.updateUser(
    request.params.id,
    request.body,
    requesterId,
    requesterRole,
  );
  return reply.send(user);
}
```

to:

```ts
async update(
  request: FastifyRequest<{ Params: UserParams; Body: UpdateUserInput }>,
  reply: FastifyReply,
) {
  const requesterId = Number(request.user.sub);
  const requesterPerms = request.user.permissions;

  const user = await this.service.updateUser(
    request.params.id,
    request.body,
    requesterId,
    requesterPerms,
  );
  return reply.send(user);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`

Expected: **zero errors**. All references to `request.user.role` have been replaced.

- [ ] **Step 5: Commit**

```bash
git add src/modules/user/
git commit -m "refactor(user): switch authz to checkPermission + presence-of-permission self-edit rule"
```

---

### Task 10: Delete legacy RBAC files

**Files:**
- Delete: `src/shared/rbac/roles.ts`
- Delete: `src/shared/rbac/check-role.ts`

- [ ] **Step 1: Verify nothing references them**

Run: `grep -rn "from.*rbac/roles" src/ api/` and `grep -rn "from.*rbac/check-role" src/ api/`

Expected: no matches. If any match appears, fix the import to use `check-permission` / `permissions.catalog` then re-run.

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/rbac/roles.ts src/shared/rbac/check-role.ts
```

- [ ] **Step 3: Verify build still passes**

Run: `npx tsc --noEmit && npm run build`

Expected: both succeed cleanly.

- [ ] **Step 4: Commit**

```bash
git add -A src/shared/rbac/
git commit -m "refactor(rbac): remove legacy role enum + checkRole factory"
```

---

### Task 11: Register new modules in `app.ts`

**Files:**
- Modify: `src/main/app.ts:13-14, 42`

- [ ] **Step 1: Add imports and route registrations**

In `src/main/app.ts`, after the existing module imports (around line 14, after `userRoutes` import), add:

```ts
import { roleRoutes } from "../modules/role/role.routes.js";
import { permissionRoutes } from "../modules/permission/permission.routes.js";
```

After the existing `app.register(userRoutes, ...)` call (around line 42), add:

```ts
  await app.register(roleRoutes, { prefix: "/roles" });
  await app.register(permissionRoutes, { prefix: "/permissions" });
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`

Expected: PASS.

- [ ] **Step 3: Start dev server and hit the new endpoints**

Run: `npm run dev` (background or separate terminal).

In another terminal:

```bash
# Login (super-admin)
curl -s -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super-admin@aki.com.br","password":"Aki@SuperAdmin#2026"}'
```

Expected: `{"token":"eyJhbGciOi..."}`. Decode the JWT (e.g. paste into https://jwt.io with no network — or use a CLI tool) and verify the payload is `{ sub, roleId, permissions: [...33 actions] }`.

Set `TOKEN=<that-token>` then:

```bash
curl -s http://localhost:3333/permissions -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3333/roles       -H "Authorization: Bearer $TOKEN"
```

Expected: `/permissions` returns grouped catalog (8 resources, 33 total entries); `/roles` returns an array containing the `Administrator` entry with all 33 permissions and `isSystem: true`.

On PowerShell, the equivalent is:

```powershell
$h = @{ Authorization = "Bearer $env:TOKEN" }
Invoke-RestMethod http://localhost:3333/permissions -Headers $h
Invoke-RestMethod http://localhost:3333/roles       -Headers $h
```

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/main/app.ts
git commit -m "feat(app): register /roles and /permissions routes"
```

---

### Task 12: Update Insomnia collection

**Files:**
- Modify: `insomnia-collection.json`

- [ ] **Step 1: Add new requests**

Open `insomnia-collection.json` in an editor (or directly via the Insomnia desktop app). Add a new folder `RBAC` containing:

- `GET /permissions` — header `Authorization: Bearer {{token}}`
- `GET /roles`
- `GET /roles/:id` (id from chained response)
- `POST /roles` body:
  ```json
  {
    "name": "Inspector",
    "description": "Read-only access to checklists.",
    "permissionIds": [29, 32]
  }
  ```
  (replace ids with values fetched from `GET /permissions`)
- `PATCH /roles/:id` body example:
  ```json
  { "permissionIds": [29, 30, 32] }
  ```
- `DELETE /roles/:id`

In the existing `POST /users` request, ensure the body's `roleId` references a dynamically created role id, not a hardcoded ADMIN constant. Example:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "changeme123",
  "roleId": 2
}
```

The `Local` / `Dev` / `Prod` env variables already exist (per [[insomnia-collection]] memory) — no changes there.

- [ ] **Step 2: Test the full happy path in Insomnia**

Manually walk through in Insomnia (Local env):

1. `POST /auth/login` (super-admin) → capture token.
2. `GET /permissions` → 200, grouped list.
3. `POST /roles` with subset → 201, role created with returned `id`.
4. `GET /roles` → 200, includes new role.
5. `PATCH /roles/:id` → 200, permissions updated.
6. `POST /users` with new `roleId` → 201.
7. Login as the new user → token's `permissions[]` matches the role's subset.
8. As new user, `GET /permissions` → 403 if `permissions:read` not in subset; 200 if included.
9. `DELETE /roles/<the-new-role-id>` while user is assigned → 409 "Role has assigned users".
10. Delete the test user, then `DELETE /roles/:id` → 204.

Also negative checks:
11. `DELETE /roles/<Administrator-id>` → 403 "System role cannot be deleted."
12. `PATCH /roles/<Administrator-id>` with `permissionIds: []` → 403 "System role must keep at least one permission."

- [ ] **Step 3: Commit**

```bash
git add insomnia-collection.json
git commit -m "chore(insomnia): add RBAC requests + update users payload to dynamic roleId"
```

---

### Task 13: Vault documentation + close out

**Files:**
- Create: `C:\Users\Usuario\Desktop\checkobra\Docs\Features\2026-05-22-permissions-and-rbac.md`
- Modify: `C:\Users\Usuario\Desktop\checkobra\Memory\Project-Knowledge\2026-05-19-rbac-roles.md`
- Modify: `C:\Users\Usuario\Desktop\checkobra\Docs\APIs\2026-05-19-users-api.md`

- [ ] **Step 1: Write feature doc**

Create `Docs/Features/2026-05-22-permissions-and-rbac.md` with: motivation, links to spec + plan in repo, summary of modules (`permission`, `role`), JWT payload change, deletion of `roles.ts` + `check-role.ts`, link back to [[2026-05-21-cors-prod-allowlist]] for context-trail, and wikilinks to `[[2026-05-19-stack-and-conventions]]`, `[[2026-05-19-data-model]]`, `[[2026-05-19-auth-module]]`, `[[2026-05-19-user-module]]`.

- [ ] **Step 2: Rewrite `Memory/Project-Knowledge/2026-05-19-rbac-roles.md`**

Replace the old "Role enum" content with the new model:
- Authz primitive is `checkPermission(...actions)`, semantics AND.
- Catalog is `src/shared/rbac/permissions.catalog.ts`, seeded into `Permission` table.
- Roles are dynamic; `Administrator` is the sole `isSystem` role at seed time.
- Reference the spec + plan in repo.

- [ ] **Step 3: Update `Docs/APIs/2026-05-19-users-api.md`**

Update the authorization column of each user route: `ADMIN` → `users:create`, `users:read`, etc. Note `PATCH /users/:id` no longer requires a permission preHandler; service enforces "self OR `users:update`".

- [ ] **Step 4: Final repo health check**

```bash
npx tsc --noEmit && npm run build && npm run lint
```

Expected: all three clean.

```bash
git status
```

Expected: clean. All changes committed across Tasks 1-12.

- [ ] **Step 5: Vault commit (no repo commit — vault is separate)**

Vault is documentation only; not part of the repo. No git action required there.

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/users-creation
gh pr create --base main --head feat/users-creation \
  --title "feat(rbac): permission catalog + dynamic roles + checkPermission refactor" \
  --body "$(cat <<'EOF'
## Summary
- Replaces role-name authz with permission-based authz.
- Introduces `Permission` catalog (33 actions) seeded from `src/shared/rbac/permissions.catalog.ts`.
- New modules: `permission` (read-only), `role` (CRUD with `isSystem` protection).
- JWT payload migrates from `{ sub, role }` to `{ sub, roleId, permissions: string[] }`; TTL 7d → 1d. **Clean break — existing tokens become invalid on deploy.**
- Legacy `roles.ts` + `check-role.ts` deleted.
- `Administrator` role is seeded with all permissions and protected (cannot be deleted; cannot have all permissions removed).

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-22-permissions-and-rbac-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-permissions-and-rbac.md`

## Test plan
- [ ] `npm run db:deploy` on Vercel preview branch applies migration without error
- [ ] Seed runs to completion, super-admin re-linked to `Administrator`
- [ ] Login → JWT carries `permissions[]` with all 33 actions
- [ ] `GET /permissions` returns grouped catalog
- [ ] `POST /roles` with subset works; `DELETE /roles/<Administrator>` → 403
- [ ] `POST /users` with new dynamic `roleId` works; relogin as that user → JWT permissions match the role's subset

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Glossary

- **`PermissionAction`** — literal union type of all `action` strings from the catalog. Imported wherever `checkPermission(...)` is called.
- **`isSystem`** — boolean on `Role`. When `true`, the role cannot be deleted and cannot lose all permissions. Currently only `Administrator` is system.
- **Clean break** — no backward-compatible token shape during rollout. Acceptable here because the only persistent user is the super-admin seed.
