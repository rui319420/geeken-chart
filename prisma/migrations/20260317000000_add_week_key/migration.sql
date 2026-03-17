ALTER TABLE "RawDiscordActivity" ADD COLUMN "weekKey" TEXT NOT NULL DEFAULT '';

UPDATE "RawDiscordActivity" SET "weekKey" = to_char(
  date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo'),
  'IYYY-"W"IW'
);

DROP INDEX "RawDiscordActivity_discordId_dayOfWeek_hour_key";
CREATE UNIQUE INDEX "RawDiscordActivity_discordId_weekKey_dayOfWeek_hour_key"
  ON "RawDiscordActivity"("discordId", "weekKey", "dayOfWeek", "hour");