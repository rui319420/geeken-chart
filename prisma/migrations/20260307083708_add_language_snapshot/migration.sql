-- CreateTable
CREATE TABLE "LanguageSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "month" TEXT NOT NULL,

    CONSTRAINT "LanguageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LanguageSnapshot_userId_language_month_key" ON "LanguageSnapshot"("userId", "language", "month");

-- AddForeignKey
ALTER TABLE "LanguageSnapshot" ADD CONSTRAINT "LanguageSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
