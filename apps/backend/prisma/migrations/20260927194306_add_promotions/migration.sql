-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT_OFF', 'FIXED_AMOUNT_OFF');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('ALL_TICKETS', 'MOVIE', 'FORMAT', 'COMPLEX');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "promotionId" TEXT;

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "scope" "PromotionScope" NOT NULL,
    "movieId" TEXT,
    "format" "TicketFormat",
    "complexId" TEXT,
    "requiresMetroClub" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_isActive_idx" ON "promotions"("isActive");

-- CreateIndex
CREATE INDEX "tickets_promotionId_idx" ON "tickets"("promotionId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserva el comportamiento vigente (10% automático para clientes MetroClub identificados)
-- como una promoción editable en vez de una constante fija en código.
INSERT INTO "promotions" ("id", "name", "type", "value", "scope", "requiresMetroClub", "isActive", "createdAt", "updatedAt")
VALUES ('promo_metroclub_default', 'Descuento MetroClub general', 'PERCENT_OFF', 10, 'ALL_TICKETS', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
