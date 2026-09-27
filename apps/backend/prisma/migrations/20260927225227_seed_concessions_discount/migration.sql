-- Preserva el pedido de negocio ("10% a toda la confitería por ser del MetroClub") como
-- una promoción editable en /promotions, en vez de un valor fijo en código. Se aplica en
-- ConcessionsService.sellProducts vía PromotionsService.getApplicableConcessionDiscount.
INSERT INTO "promotions" ("id", "name", "type", "value", "scope", "requiresMetroClub", "isActive", "createdAt", "updatedAt")
VALUES ('promo_metroclub_concessions_default', 'Descuento MetroClub confitería', 'PERCENT_OFF', 10, 'ALL_CONCESSIONS', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
