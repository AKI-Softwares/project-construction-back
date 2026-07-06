import { prisma } from "../../shared/infra/database/prisma.js";
import type { CreateUserInput, UpdateUserInput } from "./user.schema.js";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  role: { select: { id: true, name: true, isCompanyAdmin: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export class UserRepository {
  async findAll(companyId: number) {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({
      ...u,
      isCompanyAdmin: u.role?.isCompanyAdmin ?? false,
    }));
  }

  async findById(id: number) {
    const u = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!u) return null;
    return { ...u, isCompanyAdmin: u.role?.isCompanyAdmin ?? false };
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: CreateUserInput & { passwordHash: string }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
      },
      select: USER_SELECT,
    });
  }

  async createWithCompany(data: CreateUserInput & { passwordHash: string; companyId: number }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        companyId: data.companyId,
      },
      select: USER_SELECT,
    });
  }

  async update(id: number, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.roleId && { roleId: data.roleId }),
      },
      select: USER_SELECT,
    });
  }

  async delete(id: number) {
    return prisma.user.delete({ where: { id } });
  }

  async findByIdForPasswordReset(id: number, companyId: number | null) {
    return prisma.user.findFirst({
      where: {
        id,
        ...(companyId !== null ? { companyId } : {}),
      },
      select: { id: true, name: true, email: true, companyId: true },
    });
  }

  async updatePasswordAndFlag(id: number, passwordHash: string, mustChangePassword: boolean) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword },
    });
  }

  async upsertPushToken(userId: number, token: string, platform: string) {
    return prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
      select: { id: true, token: true, platform: true },
    });
  }

  async deletePushTokensByUser(userId: number) {
    return prisma.pushToken.deleteMany({ where: { userId } });
  }
}
