ALTER TABLE "archivos_cargas" DROP CONSTRAINT "archivos_cargas_estado_check";
ALTER TABLE "archivos_cargas" ADD CONSTRAINT "archivos_cargas_estado_check"
  CHECK ("estado" IN ('PENDIENTE','LISTO','VINCULADO','RETIRADO','ELIMINANDO','MIGRANDO'));

CREATE TABLE "archivos_migraciones" (
  "origen" VARCHAR(20) NOT NULL,
  "origen_id" INTEGER NOT NULL,
  "huella" VARCHAR(64) NOT NULL,
  "archivo_id" UUID NOT NULL UNIQUE,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'COPIANDO',
  "codigo_error" VARCHAR(30),
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("origen", "origen_id", "huella"),
  CONSTRAINT "archivos_migraciones_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos_cargas"("id") ON DELETE RESTRICT,
  CONSTRAINT "archivos_migraciones_origen_check" CHECK ("origen" IN ('eca','documento','foto')),
  CONSTRAINT "archivos_migraciones_estado_check" CHECK ("estado" IN ('COPIANDO','COMPLETADO','CAMBIADO','FALLIDO'))
);
