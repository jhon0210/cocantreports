ALTER TABLE "usuarios" ADD COLUMN "id_eca" INTEGER;
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_id_eca_fkey"
  FOREIGN KEY ("id_eca") REFERENCES "ecas" ("id_eca") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "usuarios_id_eca_idx" ON "usuarios" ("id_eca");

INSERT INTO "roles" ("id_perfil", "perfil")
SELECT (SELECT GREATEST(COALESCE(MAX("id_perfil"), 0), 3) + 1 FROM "roles"), 'Administrador Eca'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "perfil" = 'Administrador Eca');
