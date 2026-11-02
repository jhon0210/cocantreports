BEGIN;

-- El seeder creó materiales antiguos con códigos 101-107 que chocaban con el catálogo SUI (101-699).
-- Se trasladan sus reportes al material SUI equivalente y se eliminan los antiguos.
CREATE TEMP TABLE "_materiales_antiguos" ("codigo_viejo" INT, "nombre_viejo" TEXT, "codigo_sui" INT) ON COMMIT DROP;
INSERT INTO "_materiales_antiguos" VALUES
  (101, 'Cartón', 202), (102, 'PET', 303), (103, 'Vidrio', 499), (106, 'Papel archivo', 201), (107, 'Plástico duro', 399);

UPDATE "matReportado" r
SET "id_mat" = nuevo."id_mat"
FROM "_materiales_antiguos" m
JOIN "materiales" viejo ON viejo."codigo" = m."codigo_viejo" AND viejo."nomMaterial" = m."nombre_viejo"
JOIN "materiales" nuevo ON nuevo."codigo" = m."codigo_sui"
WHERE r."id_mat" = viejo."id_mat";

UPDATE "balance_mensual" b
SET "id_mat" = nuevo."id_mat"
FROM "_materiales_antiguos" m
JOIN "materiales" viejo ON viejo."codigo" = m."codigo_viejo" AND viejo."nomMaterial" = m."nombre_viejo"
JOIN "materiales" nuevo ON nuevo."codigo" = m."codigo_sui"
WHERE b."id_mat" = viejo."id_mat"
  AND NOT EXISTS (
    SELECT 1 FROM "balance_mensual" o
    WHERE o."periodo" = b."periodo" AND o."id_eca" = b."id_eca" AND o."id_mat" = nuevo."id_mat"
  );

DELETE FROM "materiales" viejo
USING "_materiales_antiguos" m
WHERE viejo."codigo" = m."codigo_viejo" AND viejo."nomMaterial" = m."nombre_viejo";

-- Chatarra y Aluminio se conservan (con sus reportes) y toman el código SUI que les corresponde.
UPDATE "materiales" SET "codigo" = 102, "nomMaterial" = 'CHATARRA'
WHERE "codigo" = 104 AND "nomMaterial" = 'Chatarra' AND NOT EXISTS (SELECT 1 FROM "materiales" WHERE "codigo" = 102);

UPDATE "materiales" SET "codigo" = 101, "nomMaterial" = 'ALUMINIO'
WHERE "codigo" = 105 AND "nomMaterial" = 'Aluminio' AND NOT EXISTS (SELECT 1 FROM "materiales" WHERE "codigo" = 101);

-- Metales SUI que el seeder había ocupado con los códigos antiguos.
INSERT INTO "materiales" ("codigo", "nomMaterial")
SELECT v.codigo, v.nombre
FROM (VALUES
  (101, 'ALUMINIO'), (102, 'CHATARRA'), (103, 'COBRE'), (104, 'BRONCE'), (105, 'ANTIMONIO'), (106, 'ACERO')
) AS v(codigo, nombre)
WHERE NOT EXISTS (SELECT 1 FROM "materiales" m WHERE m."codigo" = v.codigo);

COMMIT;
