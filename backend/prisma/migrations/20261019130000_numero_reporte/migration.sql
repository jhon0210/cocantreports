CREATE SEQUENCE "reporte_numero_seq" START WITH 1 INCREMENT BY 1;

ALTER TABLE "matReportado" ADD COLUMN "numero_reporte" INTEGER;

-- Los reportes existentes se numeran por comprobante (o por registro, si no tienen comprobante) en orden de creación.
WITH grupos AS (
  SELECT COALESCE("comprobante"::text, "consecutivo"::text) AS clave, MIN("consecutivo") AS primero
  FROM "matReportado"
  GROUP BY 1
), numerados AS (
  SELECT clave, ROW_NUMBER() OVER (ORDER BY primero) AS n FROM grupos
)
UPDATE "matReportado" m
SET "numero_reporte" = numerados.n
FROM numerados
WHERE COALESCE(m."comprobante"::text, m."consecutivo"::text) = numerados.clave;

SELECT setval('reporte_numero_seq', COALESCE((SELECT MAX("numero_reporte") FROM "matReportado"), 0) + 1, false);

ALTER TABLE "matReportado"
  ALTER COLUMN "numero_reporte" SET NOT NULL,
  ALTER COLUMN "numero_reporte" SET DEFAULT nextval('reporte_numero_seq'::regclass);
ALTER SEQUENCE "reporte_numero_seq" OWNED BY "matReportado"."numero_reporte";

CREATE INDEX "matReportado_numero_reporte_idx" ON "matReportado" ("numero_reporte");
