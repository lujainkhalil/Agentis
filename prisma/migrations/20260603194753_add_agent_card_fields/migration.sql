-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "agentCardData" JSONB,
ADD COLUMN     "agentCardSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agentCardUrl" TEXT;
