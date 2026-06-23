import { prisma } from "../../shared/infra/database/prisma.js";

const MY_COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class MyCompanyRepository {
  async findById(id: number) {
    return prisma.company.findUnique({ where: { id }, select: MY_COMPANY_SELECT });
  }

  async updateName(id: number, name: string) {
    return prisma.company.update({
      where: { id },
      data: { name },
      select: MY_COMPANY_SELECT,
    });
  }
}
