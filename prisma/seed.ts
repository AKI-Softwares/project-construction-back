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

  try {
    // 1. Upsert permission catalog
    for (const p of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { action: p.action },
        update: { resource: p.resource, operation: p.operation },
        create: p,
      });
    }
    const allPerms = await prisma.permission.findMany({ select: { id: true } });

    // 2. Upsert Administrator role connected to all permissions
    const adminRole = await prisma.role.upsert({
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
    const password = process.env.SUPER_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
    const usingDefault = !process.env.SUPER_ADMIN_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email: SUPER_ADMIN_EMAIL },
      update: { roleId: adminRole.id, passwordHash, name: SUPER_ADMIN_NAME },
      create: {
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        roleId: adminRole.id,
      },
    });

    console.log("\n=== Seed complete ===");
    console.log(`Permissions: ${allPerms.length} upserted`);
    console.log(`Role:        ${ADMIN_ROLE_NAME} (id=${adminRole.id}) with all permissions`);
    console.log(`User:        ${user.email} (id=${user.id})`);
    console.log(
      `Password:    ${password}${usingDefault ? "  [default — set SUPER_ADMIN_PASSWORD to override]" : "  [from env]"}`,
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
