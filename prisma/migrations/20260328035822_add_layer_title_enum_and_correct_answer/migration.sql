/*
  Warnings:

  - The `question_name` column on the `layers` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "LayerTitle" AS ENUM ('The_Question', 'The_Journal', 'The_Experience', 'The_Reflection');

-- AlterTable
ALTER TABLE "layers" ADD COLUMN     "correct_answer" TEXT,
DROP COLUMN "question_name",
ADD COLUMN     "question_name" "LayerTitle";
