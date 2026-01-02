-- CreateEnum
CREATE TYPE "Type" AS ENUM ('Text', 'Option');

-- CreateTable
CREATE TABLE "Digs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "Digs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layers" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "dig_id" TEXT NOT NULL,
    "question_name" TEXT,
    "question_type" "Type",
    "point" INTEGER,
    "question" TEXT,
    "options" TEXT[],
    "other" BOOLEAN,
    "other_text" TEXT,
    "text" TEXT,

    CONSTRAINT "Layers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Digs" ADD CONSTRAINT "Digs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layers" ADD CONSTRAINT "Layers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Layers" ADD CONSTRAINT "Layers_dig_id_fkey" FOREIGN KEY ("dig_id") REFERENCES "Digs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
