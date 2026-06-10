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
}
