-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'QUEUED',
    "summary" TEXT,
    "rootCause" TEXT,
    "confidence" DOUBLE PRECISION,
    "affectedServices" JSONB,
    "relatedDeploymentId" TEXT,
    "relatedCommitId" TEXT,
    "changedFiles" JSONB,
    "suggestedFix" JSONB,
    "risk" TEXT,
    "verificationPlan" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationEvidence" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'FACT',
    "sourceUrl" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationToolCall" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'success',
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_incidentId_key" ON "Investigation"("incidentId");

-- CreateIndex
CREATE INDEX "Investigation_status_idx" ON "Investigation"("status");

-- CreateIndex
CREATE INDEX "Investigation_createdAt_idx" ON "Investigation"("createdAt");

-- CreateIndex
CREATE INDEX "InvestigationEvidence_investigationId_idx" ON "InvestigationEvidence"("investigationId");

-- CreateIndex
CREATE INDEX "InvestigationToolCall_investigationId_idx" ON "InvestigationToolCall"("investigationId");

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationToolCall" ADD CONSTRAINT "InvestigationToolCall_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;