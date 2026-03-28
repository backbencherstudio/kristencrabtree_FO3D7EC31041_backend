-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "meditation_reminders" BOOLEAN NOT NULL DEFAULT true,
    "new_content_alerts" BOOLEAN NOT NULL DEFAULT true,
    "community_updates" BOOLEAN NOT NULL DEFAULT true,
    "notification_reminder" BOOLEAN NOT NULL DEFAULT true,
    "email_updates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
