import { prisma } from "../../shared/infra/database/prisma.js";

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: { select: { action: true } },
          },
        },
      },
    });
  }
}
