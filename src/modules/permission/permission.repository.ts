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
