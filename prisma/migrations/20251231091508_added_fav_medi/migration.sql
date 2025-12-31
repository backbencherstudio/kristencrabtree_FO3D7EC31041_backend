-- CreateTable
CREATE TABLE "favorite_meditation" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "meditation_id" TEXT,

    CONSTRAINT "favorite_meditation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "favorite_meditation" ADD CONSTRAINT "favorite_meditation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_meditation" ADD CONSTRAINT "favorite_meditation_meditation_id_fkey" FOREIGN KEY ("meditation_id") REFERENCES "meditation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
