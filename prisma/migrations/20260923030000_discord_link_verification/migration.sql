CREATE TABLE "DiscordLinkCode" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "DiscordLinkRateLimit" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL
);
