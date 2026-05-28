/*
  Warnings:

  - The `status` column on the `VisitItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('OK', 'NOK');

-- AlterTable
ALTER TABLE "VisitItem" DROP COLUMN "status",
ADD COLUMN     "status" "EvaluationStatus";
