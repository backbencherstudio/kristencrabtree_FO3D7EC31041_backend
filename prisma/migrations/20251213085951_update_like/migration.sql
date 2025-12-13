/*
  Warnings:

  - You are about to drop the column `liked_users` on the `journels` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "journels" DROP COLUMN "liked_users";

-- CreateTable
CREATE TABLE "LikeJournel" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "journelId" TEXT NOT NULL,

    CONSTRAINT "LikeJournel_pkey" PRIMARY KEY ("userId","journelId")
);

-- AddForeignKey
ALTER TABLE "LikeJournel" ADD CONSTRAINT "LikeJournel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikeJournel" ADD CONSTRAINT "LikeJournel_journelId_fkey" FOREIGN KEY ("journelId") REFERENCES "journels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
