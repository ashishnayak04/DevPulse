-- CreateTable
CREATE TABLE "FixSuggestion" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "diff" TEXT,
    "risk" TEXT,
    "verificationPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixVerification" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fixSuggestionId" TEXT,
    "deploymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "preMetrics" JSONB,
    "postMetrics" JSONB,
    "evidence" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixSuggestion_investigationId_key" ON "FixSuggestion"("investigationId");

-- CreateIndex
CREATE INDEX "FixSuggestion_investigationId_idx" ON "FixSuggestion"("investigationId");

-- CreateIndex
CREATE INDEX "FixVerification_incidentId_idx" ON "FixVerification"("incidentId");

-- CreateIndex
CREATE INDEX "FixVerification_status_idx" ON "FixVerification"("status");

-- CreateIndex
CREATE INDEX "FixVerification_deploymentId_idx" ON "FixVerification"("deploymentId");

-- AddForeignKey
ALTER TABLE "FixSuggestion" ADD CONSTRAINT "FixSuggestion_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixVerification" ADD CONSTRAINT "FixVerification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixVerification" ADD CONSTRAINT "FixVerification_fixSuggestionId_fkey" FOREIGN KEY ("fixSuggestionId") REFERENCES "FixSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixVerification" ADD CONSTRAINT "FixVerification_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;