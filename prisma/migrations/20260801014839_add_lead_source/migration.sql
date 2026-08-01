-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB', 'VECTOR');

-- AlterTable
ALTER TABLE "contact_requests" ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'WEB';
