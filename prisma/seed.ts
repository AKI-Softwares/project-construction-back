import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import { PERMISSIONS } from "../src/shared/rbac/permissions.catalog.js";

const SUPER_ADMIN_EMAIL = "super-admin@aki.com.br";
const SUPER_ADMIN_NAME = "Super Admin";
const DEFAULT_PASSWORD = "Aki@SuperAdmin#2026";
const ADMIN_ROLE_NAME = "Administrator";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not defined in .env");
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  // Resolve password before the transaction (bcrypt is CPU-bound, not DB-bound)
  const password = process.env.SUPER_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const usingDefault = !process.env.SUPER_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { permCount, adminRole, user } = await prisma.$transaction(async (tx) => {
      // 1. Upsert permission catalog
      for (const p of PERMISSIONS) {
        await tx.permission.upsert({
          where: { action: p.action },
          update: { resource: p.resource, operation: p.operation },
          create: p,
        });
      }

      // Fix 2: scope allPerms to catalog actions only
      const catalogActions = PERMISSIONS.map((p) => p.action);
      const allPerms = await tx.permission.findMany({
        where: { action: { in: catalogActions } },
        select: { id: true },
      });

      // 2. Upsert Administrator role connected to all permissions
      const adminRole = await tx.role.upsert({
        where: { name: ADMIN_ROLE_NAME },
        update: {
          isSystem: true,
          description: "Full access to all resources.",
          permissions: { set: allPerms.map((p) => ({ id: p.id })) },
        },
        create: {
          name: ADMIN_ROLE_NAME,
          isSystem: true,
          description: "Full access to all resources.",
          permissions: { connect: allPerms.map((p) => ({ id: p.id })) },
        },
      });

      // 3. Upsert super-admin user
      const user = await tx.user.upsert({
        where: { email: SUPER_ADMIN_EMAIL },
        update: { roleId: adminRole.id, passwordHash, name: SUPER_ADMIN_NAME },
        create: {
          name: SUPER_ADMIN_NAME,
          email: SUPER_ADMIN_EMAIL,
          passwordHash,
          roleId: adminRole.id,
        },
      });

      return { permCount: allPerms.length, adminRole, user, usingDefault, password };
    });

    // Log outside the transaction so we only print on success
    console.log("\n=== Seed complete ===");
    console.log(`Permissions: ${permCount} upserted`);
    console.log(`Role:        ${ADMIN_ROLE_NAME} (id=${adminRole.id}) with all permissions`);
    console.log(`User:        ${user.email} (id=${user.id})`);
    console.log(
      `Password:    ${usingDefault ? "[default — set SUPER_ADMIN_PASSWORD to override]" : "[from env]"}`,
    );
    console.log("=====================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
