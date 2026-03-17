-- AlterTable (User に discordId 追加)
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateTable
CREATE TABLE "RawDiscordActivity" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "presenceCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RawDiscordActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RawDiscordActivity_discordId_dayOfWeek_hour_key"
  ON "RawDiscordActivity"("discordId", "dayOfWeek", "hour");