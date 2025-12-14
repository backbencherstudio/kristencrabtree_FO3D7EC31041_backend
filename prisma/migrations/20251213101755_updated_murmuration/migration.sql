-- AlterTable
ALTER TABLE "murmurations" ADD COLUMN     "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "murmurations" ADD CONSTRAINT "murmurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
