-- CreateTable
CREATE TABLE "FrameworkUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "repoCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameworkUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkUsage_userId_framework_key" ON "FrameworkUsage"("userId", "framework");

-- AddForeignKey
ALTER TABLE "FrameworkUsage" ADD CONSTRAINT "FrameworkUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
