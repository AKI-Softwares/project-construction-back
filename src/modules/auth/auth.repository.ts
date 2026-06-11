import { prisma } from '../../shared/infra/database/prisma.js';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        companyId: true,
        isPlatformAdmin: true,
        mustChangePassword: true,
        roleId: true,
        company: { select: { status: true } },
        role: {
          select: {
            isCompanyAdmin: true,
            permissions: { select: { action: true } },
          },
        },
      },
    });
  }

  async findUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        company: { select: { id: true, name: true, status: true } },
        role: { select: { id: true, name: true, isCompanyAdmin: true } },
      },
    });
  }

  async findUserByIdWithPassword(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
  }

  async findCompanyBySlug(slug: string) {
    return prisma.company.findUnique({ where: { slug }, select: { id: true } });
  }

  async createCompanyWithAdmin(data: {
    company: { name: string; slug: string };
    admin: { name: string; email: string; passwordHash: string };
  }) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: data.company.name, slug: data.company.slug, status: 'PENDING' },
        select: { id: true, name: true, slug: true, status: true },
      });

      const companyAdminRole = await tx.role.create({
        data: {
          name: 'Company Admin',
          isSystem: true,
          isCompanyAdmin: true,
          companyId: company.id,
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          name: data.admin.name,
          email: data.admin.email,
          passwordHash: data.admin.passwordHash,
          companyId: company.id,
          roleId: companyAdminRole.id,
        },
        select: { id: true, name: true, email: true },
      });

      return { company, admin: user };
    });
  }

  async upsertPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
    return prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });
  }

  async findValidResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
  }

  async resetUserPassword(userId: number, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.passwordResetToken.delete({ where: { userId } });
    });
  }

  async updatePassword(userId: number, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }
}
