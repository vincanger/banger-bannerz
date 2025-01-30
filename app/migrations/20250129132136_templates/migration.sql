/*
  Warnings:

  - You are about to drop the column `postTopic` on the `GeneratedImageData` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `GeneratedImageData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GeneratedImageData" DROP COLUMN "postTopic",
DROP COLUMN "prompt",
ADD COLUMN     "imageTemplateId" TEXT,
ADD COLUMN     "promptTemplateId" TEXT,
ADD COLUMN     "userPrompt" TEXT;

-- CreateTable
CREATE TABLE "ImageTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "exampleImageUrl" TEXT NOT NULL,
    "loraUrl" TEXT,

    CONSTRAINT "ImageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userPrompt" TEXT NOT NULL,
    "postTopic" TEXT,
    "basePrompt" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "loraTriggerWord" TEXT,
    "imageTemplateId" TEXT,
    "userId" TEXT,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_imageTemplateId_key" ON "PromptTemplate"("imageTemplateId");

-- AddForeignKey
ALTER TABLE "GeneratedImageData" ADD CONSTRAINT "GeneratedImageData_imageTemplateId_fkey" FOREIGN KEY ("imageTemplateId") REFERENCES "ImageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImageData" ADD CONSTRAINT "GeneratedImageData_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_imageTemplateId_fkey" FOREIGN KEY ("imageTemplateId") REFERENCES "ImageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
