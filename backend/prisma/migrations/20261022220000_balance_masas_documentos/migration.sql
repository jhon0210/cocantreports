ALTER TABLE "matReportado" ADD COLUMN "id_eca_macroruta" INTEGER;
ALTER TABLE "matReportado" ADD CONSTRAINT "matReportado_id_eca_macroruta_fkey"
  FOREIGN KEY ("id_eca_macroruta") REFERENCES "ecas"("id_eca") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "recuperador_documentos" (
  "id" SERIAL PRIMARY KEY,
  "id_recuperador" INTEGER NOT NULL REFERENCES "recuperadores"("id_recuperador") ON DELETE CASCADE,
  "tipo" VARCHAR(20) NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "mime" VARCHAR(30) NOT NULL,
  "tamano" INTEGER NOT NULL,
  "contenido" BYTEA NOT NULL,
  CONSTRAINT "recuperador_documentos_id_recuperador_tipo_key" UNIQUE ("id_recuperador", "tipo")
);

-- Se insertan solo ECAs faltantes, sin actualizar los datos existentes.
INSERT INTO "ecas" ("codigo_nuec", "nomEca", "macroruta")
SELECT v.codigo, v.nombre, v.macroruta
FROM (VALUES
  ('1153705088', 'GIRASOLES', '1435905088'),
  ('1262605001', 'LA PAZ', '1434705001'),
  ('1737105001', 'JARDIN', '1434505001'),
  ('1153305001', 'EL POLVORIN', '1434705001'),
  ('1736905001', 'EL ESPIRITU SANTO', '1434305001'),
  ('1736705001', 'EXCEDENTES LA 75', '1434705001'),
  ('1736805001', 'PAC SAS', '1434605001'),
  ('3040905001', 'BARRANQUILLA', '1435205001')
) AS v(codigo, nombre, macroruta)
WHERE NOT EXISTS (
  SELECT 1 FROM "ecas" e WHERE e."codigo_nuec" = v.codigo OR UPPER(TRIM(e."nomEca")) = v.nombre
);

INSERT INTO "materiales" ("codigo", "nomMaterial")
SELECT v.codigo, v.nombre
FROM (VALUES
  (101, 'ALUMINIO'), (102, 'CHATARRA'), (103, 'COBRE'), (104, 'BRONCE'),
  (105, 'ANTIMONIO'), (106, 'ACERO'), (199, 'OTROS METALES'),
  (201, 'ARCHIVO'), (202, 'CARTON'), (203, 'CUBETAS O PANELES'),
  (204, 'PERIODICO'), (205, 'PLEGADIZA'), (206, 'TETRA PACK'),
  (207, 'PLASTIFICADO'), (208, 'KRAP'), (299, 'OTROS PAPELES'),
  (301, 'ACRILICO'), (302, 'PASTA'), (303, 'PET'), (304, 'PVC'),
  (305, 'PLASTICO BLANCO'), (306, 'POLIETILENO'), (307, 'SOPLADO'),
  (308, 'POLIPROPILENO'), (399, 'OTROS PLASTICOS'), (499, 'OTROS VIDRIOS'),
  (599, 'OTROS TEXTILES'), (699, 'OTROS MADERABLES')
) AS v(codigo, nombre)
WHERE NOT EXISTS (SELECT 1 FROM "materiales" m WHERE m."codigo" = v.codigo);
