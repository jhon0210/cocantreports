-- Todo recuperador necesita un código único para el código de barras del carnet.
DO $$
DECLARE
  fila RECORD;
  nuevo TEXT;
BEGIN
  FOR fila IN SELECT "id_recuperador" FROM "recuperadores" WHERE "codigo_registro" IS NULL LOOP
    LOOP
      nuevo := (10000000 + floor(random() * 90000000))::BIGINT::TEXT;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "recuperadores" WHERE "codigo_registro" = nuevo);
    END LOOP;
    UPDATE "recuperadores" SET "codigo_registro" = nuevo WHERE "id_recuperador" = fila."id_recuperador";
  END LOOP;
END $$;
