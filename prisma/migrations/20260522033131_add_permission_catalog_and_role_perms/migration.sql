/*
  Warnings:

  - You are about to drop the column `permissions` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_permissions_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "permissions",
ADD COLUMN     "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Permissions";

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RolePermissions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RolePermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- CreateIndex
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
