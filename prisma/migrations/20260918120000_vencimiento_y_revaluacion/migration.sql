-- AlterEnum
ALTER TYPE "PointLedgerType" ADD VALUE 'TASK_OVERDUE';

-- AlterTable
ALTER TABLE "contribution_settings" DROP COLUMN "carryoverPenalty",
DROP COLUMN "penaltyFloorRatio",
DROP COLUMN "penaltyPerDay",
DROP COLUMN "reworkPenalty",
ALTER COLUMN "defaultCapacityPoints" SET DEFAULT 21;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "overdueChargedAt" TIMESTAMP(3),
ADD COLUMN     "revaluationReason" TEXT,
ADD COLUMN     "revaluationRequestedAt" TIMESTAMP(3);

