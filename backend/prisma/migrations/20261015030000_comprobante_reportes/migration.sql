ALTER TABLE "matReportado" ADD COLUMN IF NOT EXISTS "comprobante" UUID;
CREATE INDEX IF NOT EXISTS "matReportado_comprobante_idx" ON "matReportado"("comprobante");
