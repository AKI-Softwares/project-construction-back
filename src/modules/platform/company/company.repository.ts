import { prisma } from '../../../shared/infra/database/prisma.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './company.schema.js';

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true } },
} as const;

export class CompanyRepository {
  async findAll(status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED') {
    const where = status ? { status } : {};
    return prisma.company.findMany({
      where,
      select: COMPANY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    return prisma.company.findUnique({ where: { id }, select: COMPANY_SELECT });
  }

  async findBySlug(slug: string) {
    return prisma.company.findUnique({ where: { slug }, select: { id: true } });
  }

  async create(data: CreateCompanyInput) {
    return prisma.company.create({ data: { ...data, status: 'ACTIVE' }, select: COMPANY_SELECT });
  }

  async update(id: number, data: UpdateCompanyInput) {
    return prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
      },
      select: COMPANY_SELECT,
    });
  }

  async updateStatus(id: number, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') {
    return prisma.company.update({ where: { id }, data: { status }, select: COMPANY_SELECT });
  }

  async seedCompanyOnActivation(
    companyId: number,
    templateRoles: { name: string; description: string | null; permissionIds: number[] }[],
    templateServices: { name: string; description: string | null; category: string | null }[],
    templateApartmentTypes: { name: string; description: string | null }[],
  ) {
    return prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.upsert({
        where: { companyId_name: { companyId, name: 'Company Admin' } },
        update: {},
        create: { name: 'Company Admin', isSystem: true, isCompanyAdmin: true, companyId },
        select: { id: true },
      });

      for (const tpl of templateRoles) {
        await tx.role.upsert({
          where: { companyId_name: { companyId, name: tpl.name } },
          update: {},
          create: {
            name: tpl.name,
            description: tpl.description,
            isSystem: false,
            isCompanyAdmin: false,
            companyId,
            permissions: { connect: tpl.permissionIds.map((id) => ({ id })) },
          },
        });
      }

      await tx.service.createMany({
        data: templateServices.map((s) => ({ ...s, companyId })),
        skipDuplicates: true,
      });

      await tx.apartmentType.createMany({
        data: templateApartmentTypes.map((a) => ({ ...a, companyId })),
        skipDuplicates: true,
      });

      const firstUser = await tx.user.findFirst({
        where: { companyId },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (firstUser) {
        await tx.user.update({
          where: { id: firstUser.id },
          data: { roleId: adminRole.id },
        });
      }

      return adminRole;
    });
  }
}
