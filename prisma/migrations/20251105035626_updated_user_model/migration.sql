-- CreateEnum
CREATE TYPE "Focus_Area" AS ENUM ('Mental_Body', 'Emotional_Body', 'Physical_Body', 'Energy_Body');

-- CreateEnum
CREATE TYPE "Weekly_Practice" AS ENUM ('Light_1_3', 'Moderate_4_7', 'Deep_4_7');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'OCCASIONALLY');

-- CreateEnum
CREATE TYPE "Content_Preference" AS ENUM ('DAILY_WISDOM_QUOTES', 'GUIDED_EXERCISES', 'MEDITATION_CONTENT', 'COMMUNITY_DISCUSSIONS', 'JOURNAL_PROMPTS', 'SCIENTIFIC_INSIGHTS');

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT,
    "content_preference" "Content_Preference"[],
    "dailyWisdomQuotes" "Frequency" NOT NULL,
    "guidedExercises" "Frequency" NOT NULL,
    "meditationContent" "Frequency" NOT NULL,
    "communityDiscussions" "Frequency" NOT NULL,
    "journalPrompts" "Frequency" NOT NULL,
    "scientificInsights" "Frequency" NOT NULL,
    "focus_area" "Focus_Area",
    "weekly_practice" "Weekly_Practice",

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "title" TEXT,
    "description" TEXT,
    "price" TEXT,
    "subtitle" TEXT,
    "tag" TEXT,
    "features" TEXT[],

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "title" TEXT,
    "body" TEXT,
    "slug" TEXT,
    "excerpt" TEXT,
    "author" TEXT,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contents_slug_key" ON "contents"("slug");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
