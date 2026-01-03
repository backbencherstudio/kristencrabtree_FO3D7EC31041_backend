/*
  Warnings:

  - You are about to drop the `Digs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Layers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Digs" DROP CONSTRAINT "Digs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Layers" DROP CONSTRAINT "Layers_dig_id_fkey";

-- DropForeignKey
ALTER TABLE "Layers" DROP CONSTRAINT "Layers_user_id_fkey";

-- DropTable
DROP TABLE "Digs";

-- DropTable
DROP TABLE "Layers";

-- CreateTable
CREATE TABLE "digs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "digs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layers" (
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

    CONSTRAINT "layers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "digs" ADD CONSTRAINT "digs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layers" ADD CONSTRAINT "layers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layers" ADD CONSTRAINT "layers_dig_id_fkey" FOREIGN KEY ("dig_id") REFERENCES "digs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
