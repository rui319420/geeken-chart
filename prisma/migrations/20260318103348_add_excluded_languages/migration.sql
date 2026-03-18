-- AlterTable
ALTER TABLE "User" ADD COLUMN     "excludedLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];
