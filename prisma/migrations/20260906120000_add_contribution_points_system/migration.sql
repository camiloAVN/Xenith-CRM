-- CreateEnum
CREATE TYPE "TaskValuationStatus" AS ENUM ('VOTING', 'EXTENDED', 'VALUED');

-- CreateEnum
CREATE TYPE "TaskCompletionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "PointLedgerType" AS ENUM ('TASK_ACCEPTED', 'TASK_REVERTED', 'SEED', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "completionRound" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "completionStatus" "TaskCompletionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "effectivePoints" DECIMAL(5,2),
ADD COLUMN     "lastRejectedAt" TIMESTAMP(3),
ADD COLUMN     "lateAccruedDays" DECIMAL(8,3) NOT NULL DEFAULT 0,
ADD COLUMN     "lateClockStartedAt" TIMESTAMP(3),
ADD COLUMN     "needsDiscussion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointsValue" DECIMAL(5,2),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "valuationStatus" "TaskValuationStatus" NOT NULL DEFAULT 'VOTING',
ADD COLUMN     "votingClosesAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "canCreateProjects" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "task_point_votes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_point_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completion_approvals" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "approved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completion_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger_entries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "PointLedgerType" NOT NULL,
    "points" DECIMAL(8,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_settings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "minVotes" INTEGER NOT NULL DEFAULT 2,
    "minPoints" INTEGER NOT NULL DEFAULT 2,
    "maxPoints" INTEGER NOT NULL DEFAULT 10,
    "penaltyPerDay" DECIMAL(5,2) NOT NULL DEFAULT 0.2,
    "penaltyFloorRatio" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "disagreementDelta" INTEGER NOT NULL DEFAULT 5,
    "votingWindowHours" INTEGER NOT NULL DEFAULT 24,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_point_votes_taskId_idx" ON "task_point_votes"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_point_votes_taskId_userId_key" ON "task_point_votes"("taskId", "userId");

-- CreateIndex
CREATE INDEX "task_completion_approvals_taskId_idx" ON "task_completion_approvals"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_completion_approvals_taskId_userId_round_key" ON "task_completion_approvals"("taskId", "userId", "round");

-- CreateIndex
CREATE INDEX "point_ledger_entries_projectId_userId_idx" ON "point_ledger_entries"("projectId", "userId");

-- CreateIndex
CREATE INDEX "point_ledger_entries_taskId_idx" ON "point_ledger_entries"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_settings_projectId_key" ON "contribution_settings"("projectId");

-- AddForeignKey
ALTER TABLE "task_point_votes" ADD CONSTRAINT "task_point_votes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_point_votes" ADD CONSTRAINT "task_point_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion_approvals" ADD CONSTRAINT "task_completion_approvals_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion_approvals" ADD CONSTRAINT "task_completion_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_settings" ADD CONSTRAINT "contribution_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_settings" ADD CONSTRAINT "contribution_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill: las tareas que ya existian quedan FUERA del sistema de puntos.
-- Sin esto heredarian el default VOTING con una ventana ya vencida y
-- apareceria todo el historico reclamando votos. Quedan con pointsValue NULL
-- ("sin puntos"); si el equipo quiere contarlas, entran por el flujo SEED.
-- ---------------------------------------------------------------------------
UPDATE "tasks"
SET "valuationStatus"    = 'VALUED',
    "votingClosesAt"     = NULL,
    "lateClockStartedAt" = NULL;

-- ---------------------------------------------------------------------------
-- Fila global de parametros (projectId = NULL). Es la que edita el dueno;
-- las filas con projectId la sobrescriben por proyecto.
-- ---------------------------------------------------------------------------
INSERT INTO "contribution_settings" ("id", "createdAt", "updatedAt")
VALUES ('global', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
