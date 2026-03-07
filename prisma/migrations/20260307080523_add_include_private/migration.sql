-- AlterTable
ALTER TABLE "User" ADD COLUMN     "includePrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;
