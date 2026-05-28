-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('OK', 'NOK');

-- AlterTable (safe: preserve OK/NOK rows, convert PENDING to NULL)
ALTER TABLE "VisitItem"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EvaluationStatus"
    USING CASE
      WHEN "status"::text = 'PENDING' THEN NULL
      ELSE "status"::text::"EvaluationStatus"
    END,
  ALTER COLUMN "status" DROP NOT NULL;
