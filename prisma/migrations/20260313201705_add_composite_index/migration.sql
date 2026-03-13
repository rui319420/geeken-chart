-- DropIndex
DROP INDEX "User_githubScore_idx";

-- DropIndex
DROP INDEX "User_joinRanking_idx";

-- CreateIndex
CREATE INDEX "User_joinRanking_githubScore_idx" ON "User"("joinRanking", "githubScore" DESC);
