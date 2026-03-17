/*
  Warnings:

  - You are about to drop the column `weekKey` on the `RawDiscordActivity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[discordId,dayOfWeek,hour]` on the table `RawDiscordActivity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RawDiscordActivity_discordId_weekKey_dayOfWeek_hour_key";

-- AlterTable
ALTER TABLE "RawDiscordActivity" DROP COLUMN "weekKey";

-- CreateIndex
CREATE UNIQUE INDEX "RawDiscordActivity_discordId_dayOfWeek_hour_key" ON "RawDiscordActivity"("discordId", "dayOfWeek", "hour");
