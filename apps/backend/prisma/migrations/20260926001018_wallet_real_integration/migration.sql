/*
  Warnings:

  - The required column `authToken` was added to the `wallet_passes` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "wallet_passes" ADD COLUMN     "authToken" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "apple_device_registrations" (
    "id" TEXT NOT NULL,
    "walletPassId" TEXT NOT NULL,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_device_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apple_device_registrations_walletPassId_deviceLibraryIdenti_key" ON "apple_device_registrations"("walletPassId", "deviceLibraryIdentifier");

-- AddForeignKey
ALTER TABLE "apple_device_registrations" ADD CONSTRAINT "apple_device_registrations_walletPassId_fkey" FOREIGN KEY ("walletPassId") REFERENCES "wallet_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
