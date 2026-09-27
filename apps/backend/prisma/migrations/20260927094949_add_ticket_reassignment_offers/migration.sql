-- AlterEnum
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'SHOWTIME_CANCELLED';

-- CreateTable
CREATE TABLE "ticket_reassignment_offers" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "suggestedShowtimeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_reassignment_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_reassignment_offers_ticketId_key" ON "ticket_reassignment_offers"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_reassignment_offers_code_key" ON "ticket_reassignment_offers"("code");

-- AddForeignKey
ALTER TABLE "ticket_reassignment_offers" ADD CONSTRAINT "ticket_reassignment_offers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_reassignment_offers" ADD CONSTRAINT "ticket_reassignment_offers_suggestedShowtimeId_fkey" FOREIGN KEY ("suggestedShowtimeId") REFERENCES "showtimes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
