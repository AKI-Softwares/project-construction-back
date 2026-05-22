import type { PermissionRepository } from "./permission.repository.js";

export class PermissionService {
  constructor(private readonly repo: PermissionRepository) {}

  async listGrouped() {
    return this.repo.findAllGroupedByResource();
  }
}
