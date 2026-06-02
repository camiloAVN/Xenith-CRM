-- CreateEnum
CREATE TYPE "EarningType" AS ENUM ('COMPANY_INCOME', 'DEDUCTION', 'USER_EARNING');

-- CreateTable
CREATE TABLE "earnings" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "EarningType" NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "earnings_projectId_idx" ON "earnings"("projectId");

-- CreateIndex
CREATE INDEX "earnings_userId_idx" ON "earnings"("userId");

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
