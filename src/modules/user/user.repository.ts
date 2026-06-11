import { prisma } from "../../shared/infra/database/prisma.js";
import type { CreateUserInput, UpdateUserInput } from "./user.schema.js";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export class UserRepository {
  async findAll() {
    return prisma.user.findMany({ select: USER_SELECT });
  }

  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
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

  async update(id: number, data: UpdateUserInput & { passwordHash?: string }) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.passwordHash && { passwordHash: data.passwordHash }),
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
}
