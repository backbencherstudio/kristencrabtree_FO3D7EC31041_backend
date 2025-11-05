-- AlterTable
ALTER TABLE "user_preferences" ALTER COLUMN "dailyWisdomQuotes" DROP NOT NULL,
ALTER COLUMN "guidedExercises" DROP NOT NULL,
ALTER COLUMN "meditationContent" DROP NOT NULL,
ALTER COLUMN "communityDiscussions" DROP NOT NULL,
ALTER COLUMN "journalPrompts" DROP NOT NULL,
ALTER COLUMN "scientificInsights" DROP NOT NULL;
