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
    return prisma.role.findMany({
      select: ROLE_SELECT,
      orderBy: { name: "asc" },
    });
  }

  async findById(id: number) {
    return prisma.role.findUnique({ where: { id }, select: ROLE_SELECT });
  }

  async findByName(name: string, companyId?: number | null) {
    return prisma.role.findFirst({
      where: companyId !== undefined ? { name, companyId } : { name },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    permissionIds: number[];
  }) {
    return prisma.role.create({
      data: {
        name: data.name,
        ...(data.description !== undefined && {
          description: data.description,
        }),
        permissions: { connect: data.permissionIds.map((id) => ({ id })) },
      },
      select: ROLE_SELECT,
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      description?: string | null;
      permissionIds?: number[];
    },
  ) {
    return prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
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
