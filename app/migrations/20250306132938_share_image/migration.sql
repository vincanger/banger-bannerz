-- CreateTable
CREATE TABLE "SharedImage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + interval '7 days',
    "token" TEXT NOT NULL,
    "generatedImageDataId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "title" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SharedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedImage_token_key" ON "SharedImage"("token");

-- AddForeignKey
ALTER TABLE "SharedImage" ADD CONSTRAINT "SharedImage_generatedImageDataId_fkey" FOREIGN KEY ("generatedImageDataId") REFERENCES "GeneratedImageData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedImage" ADD CONSTRAINT "SharedImage_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
