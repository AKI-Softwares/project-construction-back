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
      ...(input.description !== undefined && { description: input.description }),
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
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.permissionIds !== undefined && { permissionIds: input.permissionIds }),
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
