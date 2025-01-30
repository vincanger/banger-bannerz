/*
  Warnings:

  - You are about to drop the column `promptTemplateId` on the `GeneratedImageData` table. All the data in the column will be lost.
  - You are about to drop the `PromptTemplate` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `userPrompt` on table `GeneratedImageData` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "GeneratedImageData" DROP CONSTRAINT "GeneratedImageData_promptTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "PromptTemplate" DROP CONSTRAINT "PromptTemplate_imageTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "PromptTemplate" DROP CONSTRAINT "PromptTemplate_userId_fkey";

-- AlterTable
ALTER TABLE "GeneratedImageData" DROP COLUMN "promptTemplateId",
ADD COLUMN     "postTopic" TEXT,
ALTER COLUMN "userPrompt" SET NOT NULL;

-- AlterTable
ALTER TABLE "ImageTemplate" ADD COLUMN     "basePrompt" TEXT,
ADD COLUMN     "loraTriggerWord" TEXT,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "suffix" TEXT;

-- DropTable
DROP TABLE "PromptTemplate";
