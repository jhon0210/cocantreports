ALTER TABLE "recuperadores" ADD COLUMN IF NOT EXISTS "codigo_registro" VARCHAR(40);
ALTER TABLE "recuperadores" ADD COLUMN IF NOT EXISTS "caracterizacion" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "recuperadores_codigo_registro_key" ON "recuperadores"("codigo_registro");
