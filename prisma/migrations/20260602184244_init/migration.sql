-- CreateEnum
CREATE TYPE "DeveloperStatus" AS ENUM ('pending', 'verified', 'active');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('unverified', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('email', 'individual', 'company');

-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "companyName" TEXT,
    "companyNumber" TEXT,
    "website" TEXT,
    "jurisdiction" TEXT,
    "status" "DeveloperStatus" NOT NULL DEFAULT 'pending',
    "apiKey" TEXT NOT NULL,
    "verificationTier" INTEGER NOT NULL DEFAULT 1,
    "verificationMethod" "VerificationMethod" NOT NULL DEFAULT 'email',
    "verifiedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "did" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "capabilities" TEXT[],
    "status" "AgentStatus" NOT NULL DEFAULT 'unverified',
    "developerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agentDid" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_apiKey_key" ON "Developer"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_did_key" ON "Agent"("did");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
