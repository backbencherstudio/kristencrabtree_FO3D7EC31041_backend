/*
  Warnings:

  - You are about to drop the column `notification_reminder` on the `notification_settings` table. All the data in the column will be lost.
  - You are about to drop the `DigResponse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DigResponse" DROP CONSTRAINT "DigResponse_dig_id_fkey";

-- DropForeignKey
ALTER TABLE "DigResponse" DROP CONSTRAINT "DigResponse_layer_id_fkey";

-- AlterTable
ALTER TABLE "digs" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "layers" ADD COLUMN     "layer_number" INTEGER,
ADD COLUMN     "transition_message" TEXT DEFAULT 'Noticing this is where change begins.';

-- AlterTable
ALTER TABLE "meditation" ADD COLUMN     "category" TEXT,
ADD COLUMN     "is_premium" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meditation_video" TEXT,
ADD COLUMN     "sort_order" INTEGER DEFAULT 0,
ADD COLUMN     "thumbnail" TEXT,
ADD COLUMN     "type" TEXT DEFAULT 'audio';

-- AlterTable
ALTER TABLE "murmurations" ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "notification_settings" DROP COLUMN "notification_reminder",
ADD COLUMN     "dig_reminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "source" TEXT DEFAULT 'admin';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daysEngaged" INTEGER DEFAULT 0;

-- DropTable
DROP TABLE "DigResponse";

-- CreateTable
CREATE TABLE "murmuration_bookmarks" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "murmurationId" TEXT NOT NULL,

    CONSTRAINT "murmuration_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dig_responses" (
    "id" TEXT NOT NULL,
    "dig_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "response" TEXT,
    "is_correct" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dig_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dig_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dig_id" TEXT NOT NULL,
    "current_layer" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_dig_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT,
    "description" TEXT,
    "image" TEXT,
    "link_url" TEXT,
    "product_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER DEFAULT 0,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "murmuration_bookmarks_userId_murmurationId_key" ON "murmuration_bookmarks"("userId", "murmurationId");

-- CreateIndex
CREATE UNIQUE INDEX "dig_responses_user_id_dig_id_layer_id_key" ON "dig_responses"("user_id", "dig_id", "layer_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_dig_progress_user_id_dig_id_key" ON "user_dig_progress"("user_id", "dig_id");

-- AddForeignKey
ALTER TABLE "murmuration_bookmarks" ADD CONSTRAINT "murmuration_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "murmuration_bookmarks" ADD CONSTRAINT "murmuration_bookmarks_murmurationId_fkey" FOREIGN KEY ("murmurationId") REFERENCES "murmurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dig_responses" ADD CONSTRAINT "dig_responses_dig_id_fkey" FOREIGN KEY ("dig_id") REFERENCES "digs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dig_responses" ADD CONSTRAINT "dig_responses_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dig_responses" ADD CONSTRAINT "dig_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dig_progress" ADD CONSTRAINT "user_dig_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dig_progress" ADD CONSTRAINT "user_dig_progress_dig_id_fkey" FOREIGN KEY ("dig_id") REFERENCES "digs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
