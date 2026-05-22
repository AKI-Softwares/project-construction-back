# Permissions & RBAC Refactor — Design

**Date:** 2026-05-22
**Scope:** PR1 — permission catalog + dynamic roles + `checkPermission` refactor. Admin user creation enhancements are scoped as a follow-up PR2.
**Branch:** `feat/users-creation` (continues current work)

---

## 1. Motivation

Current state:

- `Role.permissionsId Int?` in `prisma/schema.prisma` models a broken **N:1** Role→Permission relation (only one permission per role).
- Authorization is role-name based via `checkRole(Role.ADMIN, ...)`; the `Permissions` table is never queried by application code.
- The `Role` enum (`ADMIN`, `MANAGER`, `INSPECTOR`) is hardcoded in `src/shared/rbac/roles.ts`. Admin cannot create new roles or change a role's capabilities without a code deploy.

Target:

- Admin can create / edit / delete roles with arbitrary names.
- Each role holds a set of permissions chosen from a fixed catalog (defined in code, seeded into DB).
- Authorization checks against the user's permission set, not the role name.
- A protected `Administrator` role exists by default and always carries all permissions.

Non-goals (deferred to PR2):

- Admin UI flow improvements for creating users (the `POST /users` endpoint already exists and stays functional throughout PR1).
- Self-service `/me` endpoints, password reset flows, audit logging.

---

## 2. Data Model

### 2.1 Schema (`prisma/schema.prisma`)

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
  action    String @unique @db.VarChar(100)  // "users:create"
  resource  String @db.VarChar(50)            // "users"
  operation String @db.VarChar(50)            // "create"
  roles     Role[] @relation("RolePermissions")

  @@map("Permission")
}
```

Notes:

- `Permission` (singular, Prisma convention) replaces the legacy `Permissions` model.
- `resource` and `operation` are denormalized from `action` to allow direct grouping in queries without parsing on the client.
- Prisma implicit M:N join table `_RolePermissions` is automatic from the `@relation("RolePermissions")` markers.
- `Role.isSystem` flags roles that cannot be deleted and cannot have all permissions removed (only `Administrator` today).

### 2.2 Migration

Single migration `add_permission_catalog_and_role_perms`:

1. Create `Permission` table.
2. Create `_RolePermissions` join.
3. Seed `Permission` rows from catalog (see §3).
4. For each existing `Role` row, link **all** permissions (current state is "role-name grants everything" so we preserve effective access).
5. Drop column `Role.permissionsId`.
6. Drop legacy table `Permissions`.

After the schema migration, `npm run db:seed` is re-run. The seed (see §9) ensures the `Administrator` role exists with `isSystem = true` and is linked to every permission, and the super-admin user is linked to it. This is the only mechanism that sets `isSystem`; the migration itself does not need to touch existing role rows.

The migration runs inside a single transaction (Prisma default). A failure rolls back the entire change.

---

## 3. Permission Catalog

**File:** `src/shared/rbac/permissions.catalog.ts`

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

Catalog evolution: a new permission is added by appending to the array and re-running `npm run db:seed` (idempotent upsert keyed by `action`). No schema migration required for additions. Removing a permission requires a migration that deletes the row from `Permission`; roles previously holding it lose it via cascade on the join table.

The literal-type export `PermissionAction` ensures typo-safe call sites: `checkPermission("users:created")` (typo) fails to compile.

---

## 4. JWT & Authorization Primitive

### 4.1 New payload shape

```ts
{ sub: string, roleId: number, permissions: string[] }
```

`permissions` is a snapshot of the user's role permissions at login. TTL is reduced from `7d` to `1d` so admin permission changes propagate within 24 hours without explicit token invalidation. Refresh-token flow is out of scope.

**Clean break:** the previous `{ sub, role: string }` payload is not preserved. Existing tokens become invalid on deploy and all users re-authenticate. This is acceptable for the current user base (super-admin only).

### 4.2 Type augmentation

`src/shared/types/fastify.d.ts`:

```ts
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; roleId: number; permissions: string[] };
    user:    { sub: string; roleId: number; permissions: string[] };
  }
}
```

### 4.3 `checkPermission` factory

**File:** `src/shared/rbac/check-permission.ts`

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

### 4.4 Deletions

- `src/shared/rbac/roles.ts` — removed.
- `src/shared/rbac/check-role.ts` — removed.

All call sites refactored in the same PR.

---

## 5. Module `permission` (read-only)

**Path:** `src/modules/permission/`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/permissions` | `permissions:read` | List catalog grouped by resource |

### Response shape

```json
[
  {
    "resource": "users",
    "permissions": [
      { "id": 1, "action": "users:read",   "operation": "read"   },
      { "id": 2, "action": "users:create", "operation": "create" }
    ]
  }
]
```

### Files

- `permission.schema.ts` — `permissionResponseSchema` (grouped shape).
- `permission.repository.ts` — `findAllGroupedByResource()`: single query ordered by `resource, operation`, grouped in memory.
- `permission.service.ts` — passthrough.
- `permission.controller.ts` — single GET handler.
- `permission.routes.ts` — registers route.

No POST / PATCH / DELETE: the catalog is source-controlled. Mutation = code + migration.

---

## 6. Module `role` (CRUD)

**Path:** `src/modules/role/`

| Method | Path | Permission | Body / Response |
|---|---|---|---|
| GET | `/roles` | `roles:read` | List roles with `permissions[]` and `_count.users` |
| GET | `/roles/:id` | `roles:read` | Role with permissions |
| POST | `/roles` | `roles:create` | `{ name, description?, permissionIds: number[] }` |
| PATCH | `/roles/:id` | `roles:update` | `{ name?, description?, permissionIds? }` |
| DELETE | `/roles/:id` | `roles:delete` | 204 |

### Business rules (`role.service.ts`)

1. **Unique name.** Duplicate → `409 "Role name already exists."`
2. **Validate `permissionIds`.** All ids must exist in `Permission`. If any are missing → `400 "Invalid permission ids: [list]"`. Implementation:
   ```ts
   const found = await prisma.permission.findMany({ where: { id: { in: permissionIds } } });
   const foundIds = new Set(found.map(p => p.id));
   const missing = permissionIds.filter(id => !foundIds.has(id));
   if (missing.length) throw new HttpError(400, `Invalid permission ids: ${missing.join(",")}`);
   ```
3. **Delete blocked when role has users.**
   ```ts
   if (role.users.length > 0) {
     throw new HttpError(409, "Role has assigned users. Reassign them before deleting.");
   }
   ```
   No cascade, no auto-reassign, no soft-delete.
4. **PATCH permissionIds = set replacement.** The request body's `permissionIds` array is treated as the final state. Prisma: `permissions: { set: [{ id }, ...] }`.
5. **System role protection (`isSystem = true`).**
   - DELETE → `403 "System role cannot be deleted."`
   - PATCH with empty `permissionIds` or removing the role's last permission → `403 "System role must keep at least one permission."`
   - Rename of `isSystem` role is allowed (admin may localize the name), but `isSystem` itself cannot be toggled via API.
6. **Self-edit rule for users (refactor of `user.service.ts`).**
   - A user with `users:update` may edit any user, including `roleId`.
   - A user without `users:update` may edit only themselves, and only the fields `name`, `email`, `password` (never `roleId`).
   - This replaces the previous `requesterRole === "ADMIN"` hardcoded check.

---

## 7. Auth Flow Update

`src/modules/auth/auth.repository.ts` gains `findByEmailWithRoleAndPerms`:

```ts
prisma.user.findUnique({
  where: { email },
  include: { role: { include: { permissions: true } } },
});
```

`src/modules/auth/auth.service.ts` — login signs the new payload:

```ts
const permissions = user.role.permissions.map((p) => p.action);
const token = app.jwt.sign(
  { sub: String(user.id), roleId: user.roleId, permissions },
  { expiresIn: "1d" }
);
```

Response payload to client unchanged in shape (`{ token, user }`) but `user.role` now reflects the dynamic role name from DB.

---

## 8. Existing call-site migration

`src/modules/user/user.routes.ts`:

| Before | After |
|---|---|
| `checkRole(Role.ADMIN, Role.MANAGER)` on `GET /` | `checkPermission("users:read")` |
| no permission gate on `GET /:id` | `checkPermission("users:read")` |
| `checkRole(Role.ADMIN)` on `POST /` | `checkPermission("users:create")` |
| no permission gate on `PATCH /:id` (service-level only) | `checkPermission("users:update")` is **not** added at the route level (self-edit users without the permission would 403 too early); service enforces the rule from §6.5. |
| `checkRole(Role.ADMIN)` on `DELETE /:id` | `checkPermission("users:delete")` |

`src/modules/user/user.service.ts:35` — `requesterRole === "ADMIN"` becomes `requesterPerms.includes("users:update")`. The controller is updated to pass `request.user.permissions` instead of `request.user.role`.

---

## 9. Seed (`prisma/seed.ts`)

Order of operations (idempotent upserts throughout):

1. Upsert each entry of `PERMISSIONS` catalog into `Permission`.
2. Upsert role `{ name: "Administrator", isSystem: true, description: "Full access" }` and connect **all** current `Permission` rows.
3. Upsert super-admin `User` linked to that role.

After running on a fresh DB, the system is operational with a fully privileged admin and the catalog ready to be consumed by the front.

---

## 10. App Registration

`src/main/app.ts`:

```ts
await app.register(permissionRoutes, { prefix: "/permissions" });
await app.register(roleRoutes,       { prefix: "/roles" });
```

---

## 11. Testing & Verification (manual)

No automated suite exists. Update `insomnia-collection.json` with:

- `GET /permissions` — list catalog.
- `POST /roles` — create role with a subset of permissions.
- `GET /roles`, `GET /roles/:id`, `PATCH /roles/:id`, `DELETE /roles/:id`.
- `POST /users` with the new `roleId` referencing a dynamically created role.
- Re-login → inspect JWT → confirm `permissions[]` matches the role's set.
- Negative checks: delete role with users → 409; PATCH `Administrator` to empty permissions → 403.

---

## 12. Convention Notes

- All new strings (error messages, response payloads, log lines) are English. PT-BR remains acceptable in inline code comments. Legacy PT-BR error messages in `auth.service.ts` and `user.service.ts` are not swept reactively; a dedicated cleanup PR may address them later.
- File naming follows the existing `kebab-case` + `[module].[layer].ts` convention from `CLAUDE.md`.
- ESM imports use `.js` extensions.
- All Prisma access goes through the singleton in `src/shared/infra/database/prisma.ts`.

---

## 13. Breaking Changes (intra-project)

- Existing JWTs become invalid on deploy (clean break, see §4.1).
- `Role.ADMIN`, `Role.MANAGER`, `Role.INSPECTOR` enum constants no longer exist; any reference outside `user.routes.ts` must also be updated.
- The legacy `Permissions` table is dropped after migration.
- Insomnia collection requires re-login after deploy.

---

## 14. Out of Scope (PR2 and beyond)

- Admin UI to create a user picking a role from the list (PR2).
- Per-user permission overrides (not on roadmap — explicitly rejected in brainstorming, "groups of permissions for roles" is the model).
- Permission scopes like `users:read:own` (rejected in brainstorming as premature).
- Refresh tokens / token revocation list.
- Sweeping legacy PT-BR error messages.
