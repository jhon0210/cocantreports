-- Estado del recuperador (Activo / Inactivo / Fallecido) como catálogo con llave foránea.
-- Cambio aditivo: los recuperadores existentes quedan en "Activo".

CREATE TABLE IF NOT EXISTS "estados_recuperador" (
  "id_estado" SMALLINT PRIMARY KEY,
  "nombre" VARCHAR(20) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "estados_recuperador_nombre_key" ON "estados_recuperador" ("nombre");

-- Ids fijos: el código de la aplicación depende de ellos (ver domain/recuperadores/estado-recuperador.entity.ts).
INSERT INTO "estados_recuperador" ("id_estado", "nombre") VALUES
  (1, 'Activo'),
  (2, 'Inactivo'),
  (3, 'Fallecido')
ON CONFLICT ("id_estado") DO NOTHING;

-- ADD COLUMN con DEFAULT constante es instantáneo en PostgreSQL 11+ (no reescribe la tabla).
ALTER TABLE "recuperadores" ADD COLUMN IF NOT EXISTS "id_estado" SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE "recuperadores"
  ADD CONSTRAINT "recuperadores_id_estado_fkey"
  FOREIGN KEY ("id_estado") REFERENCES "estados_recuperador" ("id_estado") ON DELETE NO ACTION ON UPDATE NO ACTION;
