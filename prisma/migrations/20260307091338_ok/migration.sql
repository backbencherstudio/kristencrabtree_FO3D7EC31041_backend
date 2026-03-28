/*
  Warnings:

  - A unique constraint covering the columns `[stripe_product_id]` on the table `plans` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_price_id]` on the table `plans` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserSubscription" ADD COLUMN     "plansId" TEXT;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "stripe_price_id" TEXT,
ADD COLUMN     "stripe_product_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_product_id_key" ON "plans"("stripe_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_price_id_key" ON "plans"("stripe_price_id");

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_plansId_fkey" FOREIGN KEY ("plansId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
