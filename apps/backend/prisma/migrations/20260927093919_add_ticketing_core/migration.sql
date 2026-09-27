-- CreateEnum
CREATE TYPE "TicketFormat" AS ENUM ('D2', 'D3', 'VIP', 'SUPER_VIP');

-- CreateEnum
CREATE TYPE "ShowtimeStatus" AS ENUM ('SCHEDULED', 'AT_RISK', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('STANDARD', 'VIP', 'COMPANION');

-- CreateEnum
CREATE TYPE "SeatHoldStatus" AS ENUM ('HELD', 'RELEASED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'USED', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('BOX_OFFICE', 'ONLINE', 'CORPORATE');

-- CreateTable
CREATE TABLE "movies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "rating" TEXT,
    "synopsis" TEXT,
    "posterUrl" TEXT,
    "language" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screens" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "SeatType" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "format" "TicketFormat" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showtimes" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "format" "TicketFormat" NOT NULL,
    "priceRuleId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "ShowtimeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minSalesThreshold" INTEGER,
    "minSalesDeadlineMinutesBefore" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_holds" (
    "id" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "SeatHoldStatus" NOT NULL DEFAULT 'HELD',
    "heldBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "clientId" TEXT,
    "complexId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discountApplied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "channel" "SalesChannel" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "qrToken" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "reassignedToId" TEXT,
    "riskAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screens_complexId_name_key" ON "screens"("complexId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "seats_screenId_row_number_key" ON "seats"("screenId", "row", "number");

-- CreateIndex
CREATE UNIQUE INDEX "price_rules_complexId_format_key" ON "price_rules"("complexId", "format");

-- CreateIndex
CREATE INDEX "showtimes_movieId_idx" ON "showtimes"("movieId");

-- CreateIndex
CREATE INDEX "showtimes_screenId_startsAt_idx" ON "showtimes"("screenId", "startsAt");

-- CreateIndex
CREATE INDEX "showtimes_status_startsAt_idx" ON "showtimes"("status", "startsAt");

-- CreateIndex
CREATE INDEX "seat_holds_expiresAt_idx" ON "seat_holds"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "seat_holds_showtimeId_seatId_key" ON "seat_holds"("showtimeId", "seatId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qrToken_key" ON "tickets"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_reassignedToId_key" ON "tickets"("reassignedToId");

-- CreateIndex
CREATE INDEX "tickets_showtimeId_idx" ON "tickets"("showtimeId");

-- CreateIndex
CREATE INDEX "tickets_clientId_idx" ON "tickets"("clientId");

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "price_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "showtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "showtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reassignedToId_fkey" FOREIGN KEY ("reassignedToId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
