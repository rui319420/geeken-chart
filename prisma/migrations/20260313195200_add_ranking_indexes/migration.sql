-- CreateIndex
CREATE INDEX "User_githubScore_idx" ON "User"("githubScore" DESC);

-- CreateIndex
CREATE INDEX "User_joinRanking_idx" ON "User"("joinRanking");
