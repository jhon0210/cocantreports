ALTER TABLE "ecas" ADD COLUMN "representante" VARCHAR(150);
ALTER TABLE "ecas" ADD COLUMN "codigo_nuec" VARCHAR(80);

CREATE TABLE "eca_adjuntos" (
    "id" SERIAL NOT NULL,
    "id_eca" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "contenido" BYTEA NOT NULL,
    CONSTRAINT "eca_adjuntos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eca_adjuntos_id_eca_fkey" FOREIGN KEY ("id_eca") REFERENCES "ecas"("id_eca") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "eca_adjuntos_id_eca_idx" ON "eca_adjuntos"("id_eca");
