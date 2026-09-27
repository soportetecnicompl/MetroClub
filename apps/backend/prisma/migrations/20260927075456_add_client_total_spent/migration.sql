-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill: el campo es nuevo, pero las visitas con "amountSpent" ya existían.
UPDATE "clients" c
SET "totalSpent" = COALESCE((
  SELECT SUM(v."amountSpent") FROM "visits" v WHERE v."clientId" = c."id" AND v."amountSpent" IS NOT NULL
), 0);
