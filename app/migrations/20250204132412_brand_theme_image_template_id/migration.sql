/*
  Warnings:

  - You are about to drop the column `lighting` on the `BrandTheme` table. All the data in the column will be lost.
  - You are about to drop the column `preferredStyles` on the `BrandTheme` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BrandTheme" DROP COLUMN "lighting",
DROP COLUMN "preferredStyles",
ADD COLUMN     "imageTemplateId" TEXT;
