/*
  Warnings:

  - A unique constraint covering the columns `[discordId,weekKey,dayOfWeek,hour]` on the table `RawDiscordActivity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RawDiscordActivity_discordId_dayOfWeek_hour_key";

-- AlterTable
ALTER TABLE "RawDiscordActivity" ADD COLUMN     "weekKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "RawDiscordActivity_discordId_weekKey_dayOfWeek_hour_key" ON "RawDiscordActivity"("discordId", "weekKey", "dayOfWeek", "hour");
