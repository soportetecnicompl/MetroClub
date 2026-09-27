-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ISSUED', 'REDEEMED', 'VOID');

-- CreateTable
CREATE TABLE "corporate_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_batches" (
    "id" TEXT NOT NULL,
    "corporateAccountId" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "qrToken" TEXT NOT NULL,
    "redeemedTicketId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_batches_corporateAccountId_idx" ON "ticket_batches"("corporateAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_qrToken_key" ON "vouchers"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_redeemedTicketId_key" ON "vouchers"("redeemedTicketId");

-- CreateIndex
CREATE INDEX "vouchers_batchId_idx" ON "vouchers"("batchId");

-- AddForeignKey
ALTER TABLE "ticket_batches" ADD CONSTRAINT "ticket_batches_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_batches" ADD CONSTRAINT "ticket_batches_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ticket_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemedTicketId_fkey" FOREIGN KEY ("redeemedTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

