import { prisma } from '../../../shared/infra/database/prisma.js';
import type { CreateRoleTemplateInput, UpdateRoleTemplateInput } from './role-template.schema.js';

const TEMPLATE_SELECT = {
  id: true, name: true, description: true, isSystem: true,
  permissions: { select: { id: true, action: true, resource: true, operation: true } },
  createdAt: true, updatedAt: true,
} as const;

export class RoleTemplateRepository {
  findAll() {
    return prisma.role.findMany({ where: { companyId: null, isCompanyAdmin: false }, select: TEMPLATE_SELECT, orderBy: { name: 'asc' } });
  }
  findById(id: number) {
    return prisma.role.findFirst({ where: { id, companyId: null }, select: TEMPLATE_SELECT });
  }
  create(data: CreateRoleTemplateInput) {
    return prisma.role.create({
      data: {
        name: data.name,
        ...(data.description !== undefined && { description: data.description }),
        companyId: null,
        permissions: { connect: data.permissionIds.map((id) => ({ id })) },
      },
      select: TEMPLATE_SELECT,
    });
  }
  update(id: number, data: UpdateRoleTemplateInput) {
    return prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.permissionIds !== undefined && {
          permissions: { set: data.permissionIds.map((id) => ({ id })) },
        }),
      },
      select: TEMPLATE_SELECT,
    });
  }
  delete(id: number) {
    return prisma.role.delete({ where: { id } });
  }
}
