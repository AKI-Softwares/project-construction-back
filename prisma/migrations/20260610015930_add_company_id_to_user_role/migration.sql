-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_role_id_fkey";

-- DropIndex
DROP INDEX "Role_name_key";

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "is_company_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "role_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Role_company_id_idx" ON "Role"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Role_company_id_name_key" ON "Role"("company_id", "name");

-- CreateIndex
CREATE INDEX "User_company_id_idx" ON "User"("company_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
