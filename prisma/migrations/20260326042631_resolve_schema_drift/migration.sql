/*
  Warnings:

  - A unique constraint covering the columns `[githubName]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserLanguage" ADD COLUMN     "isHiddenProfile" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_githubName_key" ON "User"("githubName");
