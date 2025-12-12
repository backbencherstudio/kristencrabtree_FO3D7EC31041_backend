-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('Text', 'Audio');

-- CreateEnum
CREATE TYPE "MurmurationType" AS ENUM ('Text', 'Image', 'Audio');

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "quote_author" TEXT,
    "quote_text" TEXT,
    "reason" TEXT,
    "user_id" TEXT,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journels" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "type" "JournalType",
    "title" TEXT,
    "body" TEXT,
    "audio" TEXT,
    "tags" TEXT[],
    "liked_users" TEXT[],
    "user_id" TEXT,

    CONSTRAINT "journels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "murmurations" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "type" "MurmurationType",
    "text" TEXT,
    "image" TEXT,
    "audio" TEXT,
    "shared_from_id" TEXT,
    "liked_users" TEXT[],

    CONSTRAINT "murmurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "murmuration_id" TEXT,
    "reply_to_comment_id" TEXT,
    "liked_users" TEXT[],
    "body" TEXT,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journels" ADD CONSTRAINT "journels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "murmurations" ADD CONSTRAINT "murmurations_shared_from_id_fkey" FOREIGN KEY ("shared_from_id") REFERENCES "murmurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_murmuration_id_fkey" FOREIGN KEY ("murmuration_id") REFERENCES "murmurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_comment_id_fkey" FOREIGN KEY ("reply_to_comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
