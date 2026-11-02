BEGIN;

-- Registros de rechazo: informan solo kilogramos rechazados, con cantidad vendida y valor en 0.
ALTER TABLE "matReportado" ADD COLUMN IF NOT EXISTS "rechazo_kg" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "matReportado" DROP CONSTRAINT IF EXISTS "matReportado_valor_positivo_chk";
ALTER TABLE "matReportado" DROP CONSTRAINT IF EXISTS "matReportado_valor_rechazo_chk";
ALTER TABLE "matReportado" ADD CONSTRAINT "matReportado_valor_rechazo_chk"
  CHECK (("rechazo_kg" = 0 AND "valor" > 0) OR ("rechazo_kg" > 0 AND "valor" = 0 AND "cantidad" = 0)) NOT VALID;

ALTER TABLE "matReportado" DROP CONSTRAINT IF EXISTS "matReportado_rechazo_no_negativo_chk";
ALTER TABLE "matReportado" ADD CONSTRAINT "matReportado_rechazo_no_negativo_chk" CHECK ("rechazo_kg" >= 0);

-- Se retira "Materiales principalmente recuperados" de la caracterización.
UPDATE "recuperadores"
SET "caracterizacion" = "caracterizacion" - 'materiales' - 'materiales_otros'
WHERE "caracterizacion" IS NOT NULL
  AND ("caracterizacion" ? 'materiales' OR "caracterizacion" ? 'materiales_otros');

COMMIT;
