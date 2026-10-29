BEGIN;

ALTER TABLE "recuperadores" DROP CONSTRAINT "recuperadores_id_eca_fkey";

ALTER TABLE "matReportado" DROP CONSTRAINT "matReportado_cantidad_positiva_chk";
ALTER TABLE "matReportado" ADD CONSTRAINT "matReportado_cantidad_no_negativa_chk" CHECK ("cantidad" >= 0) NOT VALID;

COMMIT;
