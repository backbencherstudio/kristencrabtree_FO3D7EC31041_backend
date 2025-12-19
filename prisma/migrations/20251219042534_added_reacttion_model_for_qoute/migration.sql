-- CreateTable
CREATE TABLE "QuoteReaction" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "qouteId" TEXT NOT NULL,

    CONSTRAINT "QuoteReaction_pkey" PRIMARY KEY ("userId","qouteId")
);

-- AddForeignKey
ALTER TABLE "QuoteReaction" ADD CONSTRAINT "QuoteReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteReaction" ADD CONSTRAINT "QuoteReaction_qouteId_fkey" FOREIGN KEY ("qouteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
