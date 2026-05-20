import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../../../generated/prisma/client.js";
import { env } from "../../config/env.js";

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Em dev, reutiliza a instância entre hot-reloads.
// Em produção (serverless), cada invocação cria sua própria conexão HTTP leve.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
