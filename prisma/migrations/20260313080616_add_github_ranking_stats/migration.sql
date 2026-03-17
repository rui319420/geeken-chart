-- AlterTable
ALTER TABLE "User" ADD COLUMN "githubScore" INTEGER,
ADD COLUMN "statsUpdatedAt" TIMESTAMP(3),
ADD COLUMN "totalCommits" INTEGER,
ADD COLUMN "totalIssues" INTEGER,
ADD COLUMN "totalPRs" INTEGER,
ADD COLUMN "totalStars" INTEGER;
