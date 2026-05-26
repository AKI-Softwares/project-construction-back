/*
  Warnings:

  - Added the required column `public_id` to the `Photo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "public_id" VARCHAR(200) NOT NULL;
