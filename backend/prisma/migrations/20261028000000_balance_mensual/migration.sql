CREATE TABLE "balance_mensual" (
  "id" SERIAL PRIMARY KEY,
  "periodo" DATE NOT NULL,
  "id_eca" INTEGER NOT NULL REFERENCES "ecas"("id_eca") ON DELETE RESTRICT,
  "id_mat" INTEGER NOT NULL REFERENCES "materiales"("id_mat") ON DELETE RESTRICT,
  "inventario_inicial_kg" DECIMAL(18,3) NOT NULL CHECK ("inventario_inicial_kg" >= 0),
  "salidas_kg" DECIMAL(18,3) NOT NULL CHECK ("salidas_kg" >= 0),
  "rechazos_kg" DECIMAL(18,3) NOT NULL CHECK ("rechazos_kg" >= 0),
  "entradas_cat_kg" DECIMAL(18,3) CHECK ("entradas_cat_kg" >= 0),
  "entradas_al_guardar_kg" DECIMAL(18,3) NOT NULL CHECK ("entradas_al_guardar_kg" >= 0),
  "soporte_salidas" VARCHAR(1000),
  "receptor_rechazos" VARCHAR(500),
  "observaciones" VARCHAR(1000),
  "id_user" INTEGER NOT NULL REFERENCES "usuarios"("id_user") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "balance_mensual_periodo_dia_check" CHECK (EXTRACT(DAY FROM "periodo") = 1),
  CONSTRAINT "balance_mensual_periodo_id_eca_id_mat_key" UNIQUE ("periodo", "id_eca", "id_mat")
);
CREATE INDEX "balance_mensual_id_eca_id_mat_periodo_idx" ON "balance_mensual" ("id_eca", "id_mat", "periodo");
