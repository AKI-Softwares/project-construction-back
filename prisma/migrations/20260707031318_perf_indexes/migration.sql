-- CreateIndex
CREATE INDEX "Inspection_finalized_by_id_idx" ON "Inspection"("finalized_by_id");

-- CreateIndex
CREATE INDEX "NonConformity_resolved_by_id_idx" ON "NonConformity"("resolved_by_id");
