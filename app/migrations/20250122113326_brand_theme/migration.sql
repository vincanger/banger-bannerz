-- CreateTable
CREATE TABLE "BrandTheme" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "colorScheme" TEXT[],
    "preferredStyles" TEXT[],
    "mood" TEXT[],
    "lighting" TEXT[],

    CONSTRAINT "BrandTheme_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BrandTheme" ADD CONSTRAINT "BrandTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
