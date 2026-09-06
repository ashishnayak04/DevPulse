-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "incidentId" TEXT;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Alert_incidentId_idx" ON "Alert"("incidentId");