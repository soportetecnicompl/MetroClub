-- AlterTable
ALTER TABLE "redemptions" ADD COLUMN     "costAtRedemption" DECIMAL(10,2);

-- Backfill: no existe el precio histórico real para canjes previos a este cambio,
-- así que se usa el valor actual del premio como mejor aproximación disponible.
-- De aquí en adelante, cada canje nuevo graba su propio costAtRedemption en el momento
-- del canje y ya no se ve afectado por ediciones futuras al precio del premio.
UPDATE "redemptions" r
SET "costAtRedemption" = rw."monetaryValue"
FROM "rewards" rw
WHERE rw.id = r."rewardId";
