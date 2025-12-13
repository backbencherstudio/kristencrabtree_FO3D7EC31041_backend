/*
  Warnings:

  - You are about to drop the column `liked_users` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `liked_users` on the `murmurations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "comments" DROP COLUMN "liked_users";

-- AlterTable
ALTER TABLE "murmurations" DROP COLUMN "liked_users";

-- CreateTable
CREATE TABLE "MurmurationLike" (
    "userId" TEXT NOT NULL,
    "murmurationId" TEXT NOT NULL,

    CONSTRAINT "MurmurationLike_pkey" PRIMARY KEY ("userId","murmurationId")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateIndex
CREATE INDEX "MurmurationLike_murmurationId_idx" ON "MurmurationLike"("murmurationId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- AddForeignKey
ALTER TABLE "MurmurationLike" ADD CONSTRAINT "MurmurationLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MurmurationLike" ADD CONSTRAINT "MurmurationLike_murmurationId_fkey" FOREIGN KEY ("murmurationId") REFERENCES "murmurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
