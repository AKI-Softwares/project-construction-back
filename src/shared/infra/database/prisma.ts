import { createRequire } from "module";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "../../../../generated/prisma/client.js";
import { env } from "../../config/env.js";

// In non-serverless environments (dev/test), the Neon WebSocket driver needs a
// Node.js `ws` implementation. In Vercel Edge/serverless, native WebSocket is available.
if (env.NODE_ENV !== "production") {
  const _require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  neonConfig.webSocketConstructor = _require("ws") as any;
}

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
