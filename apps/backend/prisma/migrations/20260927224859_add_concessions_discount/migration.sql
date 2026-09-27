-- AlterEnum
ALTER TYPE "PromotionScope" ADD VALUE 'ALL_CONCESSIONS';

-- AlterTable
ALTER TABLE "concession_sales" ADD COLUMN     "discountApplied" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotionId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "concession_sales_promotionId_idx" ON "concession_sales"("promotionId");

-- AddForeignKey
ALTER TABLE "concession_sales" ADD CONSTRAINT "concession_sales_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Para filas existentes (creadas antes de que existiera el descuento de confitería),
-- el subtotal es igual al total ya cobrado (no hubo descuento).
UPDATE "concession_sales" SET "subtotal" = "total" WHERE "subtotal" = 0;
