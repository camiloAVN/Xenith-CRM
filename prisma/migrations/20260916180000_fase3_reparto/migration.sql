-- AlterTable
ALTER TABLE "contribution_settings" ADD COLUMN     "founderRatio" DECIMAL(4,3) NOT NULL DEFAULT 0.15,
ADD COLUMN     "maxIndividualShare" DECIMAL(4,3) NOT NULL DEFAULT 0.45,
ADD COLUMN     "poolRatio" DECIMAL(4,3) NOT NULL DEFAULT 0.6;

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "companyAmount" DECIMAL(14,2) NOT NULL,
    "founderAmount" DECIMAL(14,2) NOT NULL,
    "poolAmount" DECIMAL(14,2) NOT NULL,
    "founderRatio" DECIMAL(4,3) NOT NULL,
    "poolRatio" DECIMAL(4,3) NOT NULL,
    "founderUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_shares" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" DECIMAL(8,2) NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "capped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payout_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payouts_projectId_idx" ON "payouts"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_shares_payoutId_userId_key" ON "payout_shares"("payoutId", "userId");

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_shares" ADD CONSTRAINT "payout_shares_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_shares" ADD CONSTRAINT "payout_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

