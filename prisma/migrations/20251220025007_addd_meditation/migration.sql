-- CreateTable
CREATE TABLE "meditation" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "meditation_name" TEXT,
    "meditation_description" TEXT,
    "meditation_audio" TEXT,

    CONSTRAINT "meditation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeditationListener" (
    "userId" TEXT NOT NULL,
    "meditationId" TEXT NOT NULL,

    CONSTRAINT "MeditationListener_pkey" PRIMARY KEY ("userId","meditationId")
);

-- CreateIndex
CREATE INDEX "MeditationListener_meditationId_idx" ON "MeditationListener"("meditationId");

-- AddForeignKey
ALTER TABLE "MeditationListener" ADD CONSTRAINT "MeditationListener_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeditationListener" ADD CONSTRAINT "MeditationListener_meditationId_fkey" FOREIGN KEY ("meditationId") REFERENCES "meditation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
