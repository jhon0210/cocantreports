ALTER TABLE "eca_adjuntos" ALTER COLUMN "contenido" DROP NOT NULL;
ALTER TABLE "recuperador_documentos" ALTER COLUMN "contenido" DROP NOT NULL;

CREATE TABLE "archivos_cargas" (
  "id" UUID PRIMARY KEY,
  "propietario_id" INTEGER,
  "uso" VARCHAR(20) NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "mime" VARCHAR(30) NOT NULL,
  "tamano" INTEGER NOT NULL,
  "sha256" VARCHAR(44) NOT NULL,
  "clave_temporal" VARCHAR(150) NOT NULL UNIQUE,
  "clave" VARCHAR(150) NOT NULL UNIQUE,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "vinculo_id" INTEGER,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_en" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "archivos_cargas_propietario_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuarios"("id_user") ON DELETE SET NULL,
  CONSTRAINT "archivos_cargas_tamano_check" CHECK ("tamano" > 0 AND "tamano" <= 2097152),
  CONSTRAINT "archivos_cargas_estado_check" CHECK ("estado" IN ('PENDIENTE','LISTO','VINCULADO','RETIRADO','ELIMINANDO')),
  CONSTRAINT "archivos_cargas_uso_check" CHECK ("uso" IN ('foto','eca','identificacion','salud','servicios'))
);
CREATE INDEX "archivos_cargas_expiracion_idx" ON "archivos_cargas"("estado","expira_en");
CREATE INDEX "archivos_cargas_vinculo_idx" ON "archivos_cargas"("uso","vinculo_id","estado");
