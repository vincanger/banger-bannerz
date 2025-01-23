-- CreateTable
CREATE TABLE "GeneratedImageData" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GeneratedImageData_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GeneratedImageData" ADD CONSTRAINT "GeneratedImageData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
