-- La ECA ya no se asigna al recuperador: se elige en cada venta (matReportado.id_eca ya existe y es NOT NULL).
-- Cambio no destructivo: la columna se conserva como opcional para no perder las asignaciones históricas.
-- Cuando ya no se necesite, basta con: ALTER TABLE "recuperadores" DROP COLUMN "id_eca";
ALTER TABLE "recuperadores" ALTER COLUMN "id_eca" DROP NOT NULL;
