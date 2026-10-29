# Balance de masas: matriz tecnica de cumplimiento

Fecha de consulta y corte de la revision: **2026-10-27**.

## 1. Alcance y conclusion

Revision de fuentes oficiales publicamente accesibles, del flujo HTTP, del modelo de datos, de la construccion del balance y de XLSX generados con datos sinteticos. Las fases 1 a 3 se entregaron antes de pedir aprobacion. Despues se implemento el alcance expresamente aprobado en las secciones 9 y 10. **No se realizaron cargas oficiales ni se cambiaron o borraron registros preexistentes del usuario.**

**Diagnostico inicial:** el modulo convertia lineas de ventas de recuperadores en filas de material entrante, sin capturas independientes de aprovechamiento efectivo, rechazo ni existencias. **Despues de la implementacion aprobada** permite capturar totales mensuales de salidas, rechazos, inventario inicial y procedencia CAT, con conciliacion y Excel interno. Sigue siendo un borrador: no implementa por completo la trazabilidad operativa ni se verifico la aceptacion del cargue SUI.

No se pudo verificar el anexo tecnico vigente de cargue SUI. Por tanto, las 11 columnas actuales, sus codigos y la semana calculada por intervalos de siete dias **no se consideran especificaciones oficiales confirmadas**. La imagen y el catalogo usados previamente en el proyecto no sustituyen una especificacion oficial identificada por version.

Este es un informe tecnico de brechas, no un certificado de cumplimiento ni asesoria juridica. No demuestra el cumplimiento de todas las leyes de la organizacion, ni sustituye la verificacion de sus operaciones fisicas, documentacion o regimen aplicable.

## 2. Fuentes oficiales y vigencia

| ID | Fuente y disposiciones revisadas | Vigencia observada y limites |
|---|---|---|
| F1 | [Decreto 1077 de 2015, texto consolidado en CRA](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm), arts. 2.3.2.5.2.12 y 2.3.2.5.2.13 | Vigente con modificaciones. El texto consultado identifica el art. 3 del Decreto 1381 de 2024 como modificatorio del balance. |
| F2 | [Decreto 1381 de 2024](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm), arts. 1 a 5 y capitulo 5 sustituido del Decreto 1077 | Vigente segun el texto consultado; publicado el 14 de noviembre de 2024. Su art. 5 modifica el capitulo y deroga el Decreto 1345 de 2021 y subsecciones indicadas. No se afirma una derogatoria integral del Decreto 596 de 2016. |
| F3 | [Resolucion MinVivienda 0412 de 2026](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm), arts. 7 a 14, 21, 25, 29, 30, 49 y 50 | Vigente desde el 16 de julio de 2026 segun encabezado y art. 50; publicada en Diario Oficial 53.554 de 15 de julio de 2026. Deroga integralmente la Resolucion 276 de 2016. |
| F4 | [Resolucion MinVivienda 276 de 2016](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0276_2016.htm), nota de vigencia | **Derogada** por el art. 50 de F3. Se consulta como antecedente, no como fundamento autonomo actual. |
| F5 | [Decreto 596 de 2016](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=69038) | Antecedente del esquema y de la formalizacion. El capitulo que incorporo al Decreto 1077 fue modificado por F2. No usar su redaccion original sin contrastarla con el texto consolidado. |
| F6 | [Ley 142 de 1994](https://normas.cra.gov.co/gestor/docs/ley_0142_1994.htm), art. 1 y remisiones sectoriales de F2/F3 | Vigente con modificaciones. Marco del servicio publico de aseo; no define por si misma las 11 columnas del Excel. |
| F7 | [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981), arts. 4 a 14 | Vigente segun texto consultado; tiene reglamentacion y condicionamientos que requieren revision complementaria, especialmente para menores. El portal advierte que su publicacion es informativa. |
| F8 | [Portal SUI - Aseo](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) y [SSPD](https://www.superservicios.gov.co/) | No verificable en esta revision: la recuperacion automatizada encontro error de resolucion de nombre o pagina de proteccion sin contenido normativo. No se sortearon controles ni se uso una cuenta del usuario. |

Todas estas fuentes se consultaron el **2026-10-27**. "Vigente" expresa lo observado en las fuentes accesibles, no una certificacion de inexistencia de actos posteriores, suspensiones judiciales o reglas territoriales. Falta localizar las instrucciones y actos SSPD/CRA posteriores aplicables al prestador y al periodo de reporte.

### Hallazgos normativos determinantes

- F1, art. 2.3.2.5.2.13, modificado por F2: balance mensual basado en pesajes de entradas, cantidades efectivamente aprovechadas y rechazos; el saldo corresponde a lo almacenado.
- F3, art. 12: registro de entradas con origen APS, fuente/tipo de usuario, aforo, cantidad por material, microrruta, macrorruta, frecuencia, fecha, vehiculo y reciclador u operario; distingue residuos del servicio publico de otros origenes.
- F3, art. 13: diferencia material procedente de CAT y entradas directas a ECA; contempla aprovechamiento efectivo y rechazos mensuales, y trazabilidad del pesaje. Para D-ORO exceptua lo relativo a CAT.
- F3, art. 14: registro del rechazo y entrega al prestador de recoleccion y transporte de no aprovechables del APS; no equivale por si solo a un catalogo numerico de destinos SUI.
- F2, art. 2.3.2.5.2.9, y F3, arts. 7 y 8: no todo transporte tiene placa. Los vehiculos de traccion humana/asistida tienen identificacion propia, en los terminos del SUI.
- F3, arts. 29 y 30: el material efectivamente aprovechado requiere soporte de venta al comercializador o industria. Un comprobante de compra al recuperador no demuestra esa salida.
- F2/F3 remiten a la SSPD la definicion de terminos del reporte; no es correcto deducir de sus articulos el orden exacto del archivo de cargue.

## 3. Evidencia del proyecto

Las referencias de codigo son relativas a este documento. La revision no verifico el contenido actual de tablas reales.

- **C1:** [balance-masas.ts](../frontend/src/lib/balance-masas.ts): `BALANCE_HEADERS`, `CATALOGO`, `TIPOS_ID`, `construirBalance`, `exportBalanceMasas`.
- **C2:** [BalanceMasasPage.tsx](../frontend/src/pages/BalanceMasasPage.tsx): `BalanceMasasPage`, `consultar`, `exportar`.
- **C3:** [reportes.service.ts](../frontend/src/services/reportes.service.ts): `reportesService.balanceMasas`, paginacion de 200 filas.
- **C4:** [reportes.controller.ts](../backend/src/presentation/reportes/reportes.controller.ts): `ReportesController.balanceMasas`, roles Administrador y Coordinador.
- **C5:** [list-get-reportes.use-cases.ts](../backend/src/application/reportes/use-cases/list-get-reportes.use-cases.ts): `ListReportesUseCase.execute`.
- **C6:** [prisma-reporte.repository.ts](../backend/src/infrastructure/persistence/reportes/prisma-reporte.repository.ts): `PrismaReporteRepository.list`, `toDomain`, `createBatch`, `update`, `delete`.
- **C7:** [schema.prisma](../backend/prisma/schema.prisma): modelos `Reporte`, `Eca`, `Material`, `Recuperador`, `RecuperadorDocumento`.
- **C8:** [create-reporte.use-case.ts](../backend/src/application/reportes/use-cases/create-reporte.use-case.ts): `CreateReporteUseCase.prepare`.
- **C9:** [reporte.dto.ts](../backend/src/application/reportes/dto/reporte.dto.ts): `CreateReporteDto`, `UpdateReporteDto`, `ReporteResponseDto`.
- **C10:** [migracion de balance y documentos](../backend/prisma/migrations/20261022220000_balance_masas_documentos/migration.sql): insercion de materiales solo cuando no existe el codigo.
- **C11:** [RecuperadorForm.tsx](../frontend/src/features/caracterizar/RecuperadorForm.tsx): `RecuperadorForm`, seccion de declaracion/autorizacion.
- **C12:** [caracterizacion.ts](../backend/src/domain/recuperadores/caracterizacion.ts): `validarCaracterizacion`, `TIPOS_DOCUMENTO`.
- **C13:** [recuperadores.controller.ts](../backend/src/presentation/recuperadores/recuperadores.controller.ts): `RecuperadoresController.documento`.
- **C14:** [documentos-recuperador.ts](../backend/src/application/recuperadores/documentos-recuperador.ts): `prepararDocumentos`.
- **C15:** [permissions.ts](../frontend/src/lib/permissions.ts): `ACCESS.balanceMasas`; [App.tsx](../frontend/src/App.tsx): ruta protegida.
- **C16:** [PrefacturarPage.tsx](../frontend/src/pages/PrefacturarPage.tsx): `consultarVentas` obtiene los mismos reportes; `agruparPorMaterial` suma sus cantidades y subtotales. No representa una salida independiente a un comprador.
- **C17:** [balance.entity.ts](../backend/src/domain/balance-masas/balance.entity.ts): `resumirBalance`, `validarCapturaBalance`, calculo en gramos; [balance.use-cases.ts](../backend/src/application/balance-masas/balance.use-cases.ts): `BalanceMasasUseCases`; [prisma-balance.repository.ts](../backend/src/infrastructure/persistence/balance-masas/prisma-balance.repository.ts): consulta mensual, persistencia y control de version; [controlador](../backend/src/presentation/balance-masas/balance-masas.controller.ts): GET/PUT para Administrador/Coordinador.
- **C18:** [BalanceMensualPanel.tsx](../frontend/src/features/balance-masas/BalanceMensualPanel.tsx): captura de inventario, salidas, rechazos, procedencia CAT y referencias; consulta integrada en C2.
- **C19:** [balance-mensual.ts](../frontend/src/lib/balance-mensual.ts): `celdasResumenBalance`, `exportResumenBalance`, masas en toneladas con seis decimales y hojas de soporte/novedades.
- **C20:** C11/C12 y [caracterizacion.ts del formulario](../frontend/src/features/caracterizar/caracterizacion.ts): `placa_habitual` opcional en caracterizacion, sin asignacion a eventos pasados.

## 4. Matriz de cumplimiento

Estados: **cumple**, **parcial**, **no cumple**, **no verificable**. "No cumple" se refiere a capacidad del modulo para representar el requisito; no es una declaracion de infraccion de la organizacion, que podria cumplir mediante otros mecanismos.

Las referencias C identifican archivo y funcion en la seccion 3. Las referencias F enlazan la fuente oficial en la seccion 2.

| ID | Requisito | Norma y articulo | URL | Fecha de consulta | Vigencia | Estado | Evidencia en el codigo | Accion |
|---|---|---|---|---|---|---|---|---|
| BM-01 | Balance mensual de entradas, aprovechamiento efectivo, rechazos y saldo almacenado | Decreto 1077/2015 art. 2.3.2.5.2.13 modificado por Decreto 1381/2024 art. 3; Resolucion 0412/2026 art. 13 | [F1](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm#2.3.2.5.2.13), [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#13) | 2026-10-27 | Vigente modificada / vigente consultada | parcial | C17 `resumirBalance` calcula inicial + entradas - salidas - rechazos; C18 captura totales por ECA/material/mes; C19 exporta resumen | Implementada conciliacion interna mensual. Pendiente trazabilidad completa de eventos, validacion externa de soportes y formato oficial. |
| BM-02 | Fecha y pesaje de la entrada fisica, distintos de la venta cuando no coinciden | Resolucion 0412/2026 arts. 12.5, 12.9 y 13.1/par. 1 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | parcial | C1 `construirBalance` usa `FechaVenta` y `cantidad`; C7 `Reporte` no registra pesaje de ingreso independiente | Registrar el evento real y su trazabilidad; confirmar si la venta del recuperador corresponde operacionalmente a la recepcion. |
| BM-03 | Cantidad por tipo de material en kg o toneladas | Resolucion 0412/2026 art. 12.5 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | parcial | C9 `ReporteResponseDto.cantidad` documenta kg; C1 divide por 1000; XLSX verificado | Conservar conversion; la cantidad comercial no acredita por si misma el peso de ingreso. Precision exacta de cargue pendiente de SUI. |
| BM-04 | Distinguir residuos del servicio publico de otros residuos excluidos de tarifa | Resolucion 0412/2026 arts. 12.1 y 30.3; Decreto 1381/2024 art. 2, definicion 99 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12), [F2](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm#2) | 2026-10-27 | Vigentes consultadas | no cumple | C7 `Reporte` y C9 `CreateReporteDto` sin procedencia ni elegibilidad tarifaria | Capturar procedencia y clasificacion de inclusion; no reportar toda compra como material elegible. |
| BM-05 | Origen por area de prestacion y fuente/tipo de usuario | Resolucion 0412/2026 arts. 12.2 y 12.3 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | no cumple | C7 `Reporte`/`Eca` sin APS ni fuente estructurados; C9 DTO sin campos | Modelar APS, municipio y fuente del ingreso; no inferirlos del nombre de ECA o comuna. |
| BM-06 | Indicacion de usuario aforado o no | Resolucion 0412/2026 art. 12.4 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | no cumple | C7 `Reporte`, C9 `CreateReporteDto` sin aforo | Capturar condicion correspondiente al ingreso/fuente y reglas aplicables. |
| BM-07 | Microrruta, macrorruta y frecuencia de recoleccion del ingreso | Resolucion 0412/2026 arts. 12.6 a 12.8 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | parcial | C1 exporta macroruta; C7 `Reporte.id_eca_macroruta` enlaza otra ECA; C8 `prepare` solo verifica que exista una macroruta | Asociar rutas/frecuencia al ingreso y APS; verificar pertenencia, no confundir caracterizacion general del recuperador con ruta de cada evento. |
| BM-08 | Identificar vehiculo, contemplando motorizados y traccion humana/asistida | Resolucion 0412/2026 arts. 7, 8 y 12.10; Decreto 1077/2015 art. 2.3.2.5.2.9 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#7), [F2](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm) | 2026-10-27 | Vigentes consultadas | parcial | C20 guarda placa habitual opcional. C1 conserva placa de cada ingreso vacia; C7 sin vehiculo del movimiento | Por decision expresa, identificacion historica de cada ingreso pendiente. La placa habitual no acredita ese requisito ni identifica vehiculos sin placa. |
| BM-09 | Reciclador u operario vinculado al ingreso | Resolucion 0412/2026 art. 12.11 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12) | 2026-10-27 | Vigente consultada | parcial | C7 `Reporte.id_recuperador` opcional en modelo, obligatorio al crear por C9; C1 exporta documento del recuperador y no identifica operario alternativo | Validar responsable del evento; definir operarios diferenciados sin equiparar automaticamente autor del registro y persona que entrega. |
| BM-10 | Distinguir ingresos directos y procedentes de CAT, cuando aplique | Resolucion 0412/2026 arts. 12 par. 2 y 13.1/par. 2 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#13) | 2026-10-27 | Vigente consultada | parcial | C17/C18 registran cantidad CAT como parte de entradas, nunca adicional; C19 calcula parte directa si se declaro CAT | Confirmado uso de CAT. Falta identificar instalaciones y vincular cada traslado/ingreso; cantidad CAT desconocida permanece nula. |
| BM-11 | Cantidad mensual efectivamente aprovechada y soportes de venta al comprador | Resolucion 0412/2026 arts. 13.2, 29 y 30.1 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#29) | 2026-10-27 | Vigente consultada | parcial | C17/C18 guardan total mensual de salidas y exigen compradores/referencias de facturas si es positivo | Falta evidencia documental verificable por factura y comprador; una referencia textual no valida la factura DIAN ni sustituye los soportes del prestador. Prefactura no se descuenta como salida. |
| BM-12 | Cantidad real de rechazo y entrega al prestador de no aprovechables | Resolucion 0412/2026 arts. 13.3 y 14 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#14) | 2026-10-27 | Vigente consultada | parcial | C17/C18 guardan rechazo mensual y exigen receptor/referencia de entrega cuando es positivo; confirmacion explicita de cantidades | Falta trazabilidad individual de entregas y verificacion de soportes. No se asigna rechazo mensual a cada ingreso ni se rellena columna oficial por suposicion. |
| BM-13 | Saldo almacenado y continuidad entre periodos | Decreto 1077/2015 art. 2.3.2.5.2.13 | [F1](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm#2.3.2.5.2.13) | 2026-10-27 | Vigente modificada | parcial | C17 calcula saldo y exige continuidad con mes inmediato anterior capturado; detecta cambios de entradas y negativos; C18 no inventa saldo inicial cero | Falta sustentacion del inventario de apertura, conteo fisico, ajustes/transferencias detallados y cierre auditado. Sin mes previo se marca inventario inicial declarado no conciliado. |
| BM-14 | Numero unico ECA asignado por SSPD | Decreto 1077/2015 art. 2.3.2.5.2.12.4; Resolucion 0412/2026 art. 9.1 | [F1](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm#2.3.2.5.2.12), [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#9) | 2026-10-27 | Vigentes consultadas | parcial | C7 `Eca.codigo_nuec` opcional; C1 solo comprueba digitos | Confrontar identificador con registro oficial de cada ECA; expresion regular no verifica asignacion ni pertenencia al prestador. |
| BM-15 | ECA y APS registradas a nombre del prestador que reporta | Resolucion 0412/2026 art. 30.2 | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#30) | 2026-10-27 | Vigente consultada | no verificable | C7 no representa prestador/RUPS/APS; C2 permite todas las ECAs | Solicitar RUPS y relacion oficial prestador-ECA-APS. No afirmar incumplimiento organizacional a partir de ausencia de columnas. |
| BM-16 | Seleccion del periodo mensual y recuperacion paginada | Decreto 1077/2015 art. 2.3.2.5.2.13 | [F1](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm#2.3.2.5.2.13) | 2026-10-27 | Vigente modificada | parcial | C2 `consultar` delimita mes; C3 `balanceMasas` solicita todas las paginas; C5/C6 filtran por venta | Reutilizar consulta mensual sobre fecha del evento aplicable; revisar consistencia de paginacion si hay ediciones concurrentes. No acredita presentacion oportuna. |
| BM-17 | Especificacion vigente: columnas, orden, nombres, obligatoriedad y formato de archivo | Decreto 1077/2015 art. 2.3.2.5.4.1; Resolucion 0412/2026 arts. 13 y 30; anexo SSPD pendiente de identificar | [F2](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm), [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | Marco vigente; anexo no verificado | no verificable | C1 `BALANCE_HEADERS` tiene 11 columnas y `exportBalanceMasas` produce XLSX con 2 hojas | Solicitar anexo/manual oficial y su version. No afirmar que XLSX con encabezados/hoja Novedades sea archivo aceptable para cargue. |
| BM-18 | Precision, redondeo, separadores y tipos de celda admitidos | Resolucion 0412/2026 art. 12.5; especificacion SSPD pendiente | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12), [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | Norma vigente; detalle no verificado | no verificable | C1 formato `0.000000` solo para cantidad entrante; C9 admite 3 decimales en kg; C7 usa Float | Verificar precision oficial y aritmetica de conciliacion. Si se agrega rechazo, no heredar el formato entero aplicado hoy a otras columnas numericas. |
| BM-19 | Numero de semana y regla para semanas que cruzan meses | Especificacion SSPD pendiente de identificar; no establecida en articulos de balance revisados | [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | No verificable | no verificable | C1 `Math.ceil(dia/7)`; prueba cubre esos intervalos | Solicitar definicion oficial. Que una prueba pase solo confirma la decision actual, no su legalidad. No sustituir por semana ISO sin fuente. |
| BM-20 | Catalogo oficial de materiales y correspondencia historica | Resolucion 0412/2026 art. 12.5; codificacion SSPD pendiente | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#12), [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | Norma vigente; catalogo no verificado | no verificable | C1 `CATALOGO` rechaza diferencias de nombre/codigo; C10 conserva materiales preexistentes con igual codigo | Obtener catalogo versionado. El conflicto historico 101-106 no se contrasto con BD; no renombrar datos ni reinterpretar reportes existentes. Definir equivalencias explicitas aprobadas. |
| BM-21 | Codificacion oficial de tipos de documento | Resolucion 0412/2026 art. 25; catalogo tecnico SSPD pendiente | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#25), [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | Norma vigente; codigos no verificados | no verificable | C1 `TIPOS_ID`: CC=1, CE=2, Pasaporte=3, NIT=4; C12 admite TI/PPT/Otro sin equivalencia | Solicitar tabla oficial, incluidos casos de reciclador/operario; conservar documento y ceros iniciales, no convertir tipos desconocidos a CC. |
| BM-22 | Catalogos y obligatoriedad de tipo/numero unico del sitio de destino | Resolucion 0412/2026 art. 14 establece entrega; codificacion SSPD pendiente | [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#14), [F8](https://sui.superservicios.gov.co/Reportes-del-sector/Aseo) | 2026-10-27 | Norma vigente; catalogo no verificado | no verificable | C1 `BALANCE_SUGERENCIAS` propone 1=relleno y 2=transferencia sin fuente versionada | No implementar esos numeros como oficiales hasta verificar anexo, excepciones y registro del destino; distinguir receptor de recoleccion y sitio de disposicion. |
| BM-23 | Tipo de prestador, fase de regularizacion y obligaciones diferenciadas | Decreto 1077/2015 arts. 2.3.2.5.1.4, 2.3.2.5.3.5; Resolucion 0412/2026 arts. 13 par. 2, 21 y 24 | [F2](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm), [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#21) | 2026-10-27 | Vigentes consultadas | no verificable | C7 no modela tipo de prestador ni fase; C1 aplica una sola transformacion | Solicitar tipo ORO/D-ORO, municipio/categoria, fecha RUPS y fase. No imponer a todos el mismo flujo CAT ni plazos deducidos sin esa informacion. |
| BM-24 | Pesajes respaldados por bascula calibrada y operacion fisica verificable | Decreto 1077/2015 art. 2.3.2.5.2.12.3; Resolucion 0412/2026 art. 13 par. 1 | [F1](https://normas.cra.gov.co/gestor/docs/decreto_1077_2015.htm#2.3.2.5.2.12), [F3](https://normas.cra.gov.co/gestor/docs/resolucion_minviviendact_0412_2026.htm#13) | 2026-10-27 | Vigentes consultadas | no verificable | C9 valida rango numerico, no calibracion; C7 no enlaza ticket/bascula; ECA tiene adjuntos genericos | Solicitar certificados y procedimiento de pesaje. Software puede enlazar evidencia, no certificar condiciones fisicas. |
| DP-01 | Finalidad, informacion al titular y prueba de autorizacion, salvo excepcion legal | Ley 1581/2012 arts. 4, 9, 10 y 12 | [F7](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) | 2026-10-27 | Vigente consultada | parcial | C11 aviso/checkbox; C12 `validarCaracterizacion` exige autorizacion en escenarios definidos; C7 guarda JSON | Revisar finalidad de reporte/exportacion, responsable y canales; acreditar prueba consultable y contenido informado. El booleano no permite por si solo reconstruir aviso/version entregados. |
| DP-02 | Tratamiento especial de datos de salud y de menores cuando existan | Ley 1581/2012 arts. 5, 6, 7 y 12.b | [F7](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) | 2026-10-27 | Vigente; alcance de condicionamientos pendiente | parcial | C7 documentos de salud y caracterizacion; C14 valida formato/tamano; C11 autorizacion general | Revisar necesidad, facultatividad, fundamento y autorizacion aplicables a datos sensibles. Para menores solicitar analisis juridico de excepciones/garantias; no inferir prohibicion absoluta ni habilitacion por aceptar TI. |
| DP-03 | Acceso restringido y confidencialidad de identificaciones y documentos | Ley 1581/2012 arts. 4.f, 4.g, 4.h y 13 | [F7](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) | 2026-10-27 | Vigente consultada | parcial | C4/C15 restringen balance; C13 restringe descarga; C1 XLSX contiene identificaciones | Mantener controles; revisar custodia y destinatarios del archivo fuera de la app. RBAC observado no certifica seguridad integral ni politica operativa de la organizacion. |
| DP-04 | Derechos y canales de consulta, rectificacion y reclamo | Ley 1581/2012 arts. 8, 11, 12 y 14 | [F7](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) | 2026-10-27 | Vigente consultada | no verificable | C11 aviso visible no identifica canal completo de atencion; CRUD interno no demuestra procedimiento del responsable | Solicitar politica y procedimiento externos. No agregar un portal de titulares sin confirmar alcance y forma de cumplimiento existente. |

## 5. Comparacion concreta del Excel actual

| Posicion | Columna actual | Comportamiento comprobado | Resultado de contraste |
|---|---|---|---|
| 1 | NUECA | Cadena numerica de `eca.codigo_nuec`; vacio si no es numerica | Se confirma necesidad de numero unico ECA, no nombre/longitud/tipo exactos de la columna SUI ni asignacion real. |
| 2 | NUMACRO | Codigo numerico desde ECA usada como macroruta | La macrorruta figura en F3 art. 12; catalogo y relacion con APS pendientes. |
| 3 | Numero de semana | Techo del dia de venta dividido entre 7 | Sin respaldo tecnico oficial verificado. |
| 4 | Tipo de identificacion | Tabla local de cuatro equivalencias | Codigos oficiales no verificados; otros tipos quedan vacios. |
| 5 | Numero de identificacion | Texto; conserva ceros iniciales | Capacidad tecnica confirmada; formato oficial pendiente. |
| 6 | Placa del vehiculo | Siempre vacia | Falta vehiculo del ingreso. No toda identificacion vehicular es una placa. |
| 7 | Cantidad entrante | Cantidad de venta / 1000, formato de 6 decimales | Conversion correcta si origen es kg; falta acreditar que sea ingreso pesado. |
| 8 | Tipo de material | Codigo si coincide con nombre normalizado del catalogo local | Evita exportar algunas incompatibilidades, pero no acredita catalogo oficial. |
| 9 | Rechazo asociado | Siempre vacio | Falta registro de rechazo; no se puede asumir cero. |
| 10 | Tipo de destino | Siempre vacio | Campo/catalogo oficial y regla condicional pendientes. |
| 11 | Numero unico de destino | Siempre vacio | Campo/catalogo oficial y regla condicional pendientes. |

El XLSX tambien contiene la hoja `Novedades`. Es util como borrador interno, pero su aceptacion por el cargador oficial no se verifico. Tampoco se verificaron CSV, delimitadores, codificacion, limites de tamano ni fechas de vencimiento del reporte. No se debe cambiar a CSV ni eliminar hojas basandose solo en una suposicion.

**El archivo de once columnas no incluye todos los componentes del balance:** salidas efectivamente aprovechadas y existencias inicial/final se incorporaron al **nuevo resumen mensual interno**, que es una exportacion distinta. Tener completas esas once columnas no bastaria para acreditar BM-01.

## 6. Brechas priorizadas y alcance propuesto

Impacto se refiere al objetivo de producir un balance verificable, no a severidad juridica. Esfuerzo relativo: bajo, medio o alto; no es estimacion de calendario. Esta tabla conserva la propuesta inicial; las secciones 9 y 10 delimitan lo efectivamente aprobado e implementado. No se considera aprobada toda la propuesta por extension.

| Prioridad | Brecha | Impacto | Esfuerzo | Capas/superficies afectadas | Condicion previa |
|---|---|---|---|---|---|
| P0 | Identificar prestador/regimen y especificacion oficial SUI vigente | Bloquea afirmar conformidad del cargue | Bajo/medio, dependiente de documentacion | Matriz y especificacion; sin migracion por investigar | RUPS, ORO/D-ORO, APS, fase, CAT y manual/anexo del reporte habilitado |
| P1 | Separar eventos de recepcion de la operacion comercial; origen, fuente, aforo, fecha y pesaje | Alto, BM-02 a BM-06/BM-24 | Alto | Migracion; dominio/puertos; casos de uso/DTO; repositorios; API; tipos, formulario y consulta; Excel | Definir flujo real y trazabilidad del pesaje; decidir reutilizacion o nueva entidad sin alterar significado historico |
| P1 | Registrar aprovechamiento efectivo/salidas, rechazos y continuidad de inventario; consolidar balance mensual | Alto, BM-01/BM-11 a BM-13 | Alto | Migracion; dominio y reglas de conciliacion; aplicacion; infraestructura; API; formularios; Excel | Inventario inicial sustentado, soportes de compradores, tratamiento de ajustes y traslados; no inventar saldos historicos |
| P1 | Incorporar vehiculo e identificacion segun tipo; rutas y frecuencia del ingreso | Alto, BM-07/BM-08 | Medio | Catalogos/modelo y migracion; validaciones/API; formularios; Excel | Catalogos oficiales e identificadores reales; sin placa obligatoria universal |
| P1 | Registrar receptor/entrega de rechazo y procedencia CAT cuando aplique | Alto, BM-10/BM-12 | Medio/alto | Migracion; dominio/aplicacion/infraestructura/API; formularios; Excel | Confirmar CAT y prestador receptor; catalogos de sitio separados de la obligacion general |
| P2 | Ajustar columnas, tipos, semanas, codigos, precision y archivo de cargue | Alto para interoperabilidad, BM-17 a BM-22 | Medio tras obtener anexo | Excel, pruebas, tipos; API/catalogos si exige nuevos datos; migracion solo si necesaria | Especificacion oficial versionada. Diferenciar exportacion interna y archivo oficial |
| P2 | Completar trazabilidad de autorizacion y revisar tratamiento de datos sensibles/exportaciones | Alto para proteccion de datos, DP-01 a DP-04 | Medio, alcance sujeto a politica existente | Politica operativa; formularios; DTO/casos de uso; almacenamiento si se aprueba; exportacion | Identificar responsable, politica, canales, fundamento y revision juridica de supuestos especiales |
| P3 | Soportar evidencia de basculas, ECA y cumplimiento operativo | Relevante, pero no resoluble solo con codigo | Variable | Catalogos/adjuntos, procedimientos y verificacion fisica; no necesariamente nuevo modulo | Certificados, PPSA/PGIRS, responsables y evidencia externa |

La conciliacion tecnica existencia inicial + entradas - salidas aprovechadas - rechazos = existencia final se implemento para los totales mensuales aprobados. No es una formula de cargue SUI verificada; el tratamiento detallado de transferencias/ajustes y sus soportes sigue pendiente.

No se modificaron nombres/codigos historicos 101-106, no se rellenaron datos faltantes ni se convirtieron compras en salidas industriales. La aprobacion posterior de la seccion 9 autorizo exclusivamente la migracion aditiva, las nuevas capturas y sus pruebas con datos propios.

## 7. Verificacion del diagnostico inicial (antes de implementar)

- Lectura del flujo frontend, servicio HTTP paginado, controlador, caso de uso, repositorio, DTO, esquema y migracion relacionada.
- **33 pruebas existentes frontend aprobadas**, en [balance-masas.test.ts](../frontend/src/lib/balance-masas.test.ts) y [routes.test.tsx](../frontend/src/components/layout/routes.test.tsx). Las pruebas existentes de exportacion mockean el escritor; no prueban aceptacion oficial.
- **9 pruebas unitarias backend aprobadas**, en [create-reporte.use-case.spec.ts](../backend/src/application/reportes/use-cases/create-reporte.use-case.spec.ts). No acceden a la BD real.
- **1 comprobacion temporal adicional aprobada:** ejecuto `construirBalance` y `exportBalanceMasas` con tres registros sinteticos y adapto exclusivamente la salida del escritor a su variante Node para generar un XLSX binario real en memoria. Se descomprimio el archivo y se comprobaron dos hojas, once encabezados, documento textual con ceros iniciales, 1250 kg = 1.25 t, 0.001 kg = 0.000001 t, semana local para dia 31, vacios reales y material incompatible excluido. El arnes temporal se elimino. No se probo la descarga en navegador ni el cargador SUI.
- No hubo inserciones, consultas ni modificaciones en `reportesbd`; tampoco envio de datos personales, levantamiento de servidores o cargas a terceros.
- No se compilo ni ejecuto e2e: el unico cambio persistente es este documento; la implementacion y su validacion integral corresponden a fases 4 y 5 tras aprobacion.
- No se hizo auditoria juridica exhaustiva, revision de vulnerabilidades ni verificacion fisica. No se verificaron certificados de basculas, RUPS, registro real de ECA/APS, soportes de compradores, presentaciones SUI ni politicas internas.

## 8. Informacion necesaria y punto de aprobacion inicial

1. Manual/anexo tecnico vigente del reporte SUI habilitado: nombre/codigo del formato, resolucion que lo adopta/modifica, version, catalogos y plantilla oficial sin datos personales. Si la imagen original procede de un manual, adjuntar el documento completo y su fecha.
2. Tipo de prestador (ORO o D-ORO), fecha de inscripcion RUPS, fase de regularizacion, municipio/APS y uso o no de CAT.
3. Confirmacion de si las ventas actuales son compras de la ECA al recuperador al momento de recibir material. Definir como se pesan, venden a industria/comercializadores, registran rechazos y controlan inventarios.
4. Evidencia de asignacion de NUECA/rutas y certificados pertinentes, preferentemente sin informacion personal innecesaria.
5. Politica de tratamiento, responsable y canales, para revisar lo que ya se cumple fuera de la aplicacion.

**Se solicito aprobacion al finalizar fase 3.** Las decisiones posteriores estan registradas a continuacion. Las equivalencias de catalogos/semanas/destinos y la aceptacion SUI siguen pendientes de documentacion.

Documentacion general pendiente: README y solicitudes HTTP cuando se aprueben e implementen cambios, y solo si se solicita su actualizacion.

## 9. Aprobacion y aclaraciones posteriores del usuario

Recibidas el 2026-10-27, despues de presentar las fases 1 a 3:

- Se aprueba trabajar las brechas confirmadas, **definiendo antes los datos operativos**. No equivale a aprobar equivalencias o formatos SUI no verificados.
- Hay CAT antes de la ECA, segun lo informado por el usuario; faltan identificar instalaciones y trazabilidad de traslados.
- El recuperador entrega el material; el administrador de la ECA lo pesa y lo registra en Crear Reporte. Por tanto, en este flujo la operacion comercial representa recepcion en la ECA, no venta posterior a industria.
- **No modificar nada del modulo Crear Reporte**, por instruccion expresa. Cualquier captura adicional debe proponerse fuera de ese modulo y acordarse antes.
- La prefactura mensual consolida lo registrado para la ECA. C16 confirma que utiliza las mismas lineas; no demuestra un segundo movimiento fisico ni aprovechamiento efectivo. No debe restarse automaticamente como salida del inventario.
- Se autorizaron migraciones aditivas, sin cambiar ni borrar registros existentes; no se ha aplicado ninguna.
- El usuario solicita capturar la **placa habitual opcional en Caracterizar Recuperador**, no en Crear Reporte; posteriormente confirmo que la identificacion historica de cada ingreso debe permanecer pendiente.
- Se aprobo agregar capturas de **salidas, rechazos e inventario dentro de Balance de Masas**, sin tocar Crear Reporte ni Prefacturar.
- Tipo ORO/D-ORO, municipio/APS, fase, salidas reales, rechazos e inventario inicial continuan sin definir. La explicacion de las siglas y la aclaracion del alcance preceden a la implementacion.

ORO significa **Organizacion de Recicladores de Oficio**. La definicion juridica corresponde al numeral 85 del art. 2.3.2.1.1 del Decreto 1077 de 2015, modificado por el art. 1 del [Decreto 1381 de 2024](https://normas.cra.gov.co/gestor/docs/decreto_1381_2024.htm#1): organizacion constituida en su totalidad por recicladores de oficio, registrada ante la SSPD y cuyo objeto social incluye aprovechamiento. No es un perfil de usuario ni sinonimo de ECA o CAT. Su clasificacion no puede deducirse del nombre Cocjant; requiere documentacion del prestador.

## 10. Implementacion aprobada y limites

Nota posterior: por confirmacion del usuario, el panel y la exportacion mensual interna se retiraron de la pantalla Balance de Masas. Se conservan las capturas existentes y el backend; no se borraron datos. La pantalla consulta unicamente reportes de ingresos y exporta las once columnas de la imagen, sin consultar prefacturas ni el resumen mensual. La columna 6 (placa) permanece visible al desplazar la tabla y sigue vacia en Excel si falta el dato del ingreso; no utiliza la placa habitual como evidencia historica. Las referencias siguientes al panel describen la implementacion anterior a este ajuste.

- Tabla [balance_mensual](../backend/prisma/schema.prisma) mediante [migracion aditiva](../backend/prisma/migrations/20261028000000_balance_mensual/migration.sql), aplicada sin actualizaciones ni borrados de datos preexistentes.
- Una captura por mes/ECA/material: inventario inicial, total de salidas efectivas, rechazo, cantidad procedente de CAT incluida en las entradas, referencias de soporte, observaciones, autor, fecha de actualizacion y version.
- Las entradas se consolidan desde los reportes existentes porque el usuario confirmo que representan compras pesadas al recibir material. No se deduce una segunda salida de la prefactura.
- Conciliacion en backend y gramos enteros; rechaza saldos negativos al guardar, CAT superior a entradas, salidas/rechazos positivos sin referencias, ruptura con el mes anterior y consultas/versiones obsoletas.
- La consulta incluye saldos previos aunque no haya nuevas recepciones y no oculta materiales con capturas historicas cuando se omite un mes. En ese caso no inventa continuidad: conserva el saldo inmediato anterior como pendiente. Si cambian reportes despues de capturar, muestra novedades y requiere revisar. No se introdujo bloqueo ni modificacion del modulo de reportes.
- Inventario inicial/salidas/rechazos deben ingresarse explicitamente y confirmarse como medidos/soportados. No se sustituyen desconocidos por cero. CAT puede quedar pendiente (null).
- Los periodos sin captura inmediata anterior mantienen inventario inicial como declaracion no conciliada; no se reconstruye historia inventada.
- El control de version evita sobrescribir capturas editadas por otra persona. Es una captura de totales corregible, **no un libro inmutable de movimientos ni un cierre contable auditado**.
- Acceso a nuevas consultas/capturas para Administrador y Coordinador, igual que el modulo existente.
- Placa habitual opcional en caracterizacion, validada y normalizada; se puede omitir al caracterizar vehiculos sin placa. No se copia a reportes pasados ni se agrega al archivo de once columnas.
- Exportacion nueva de resumen mensual interno, con todas las masas en toneladas a seis decimales y hoja de referencias/novedades. Se conserva separado el borrador anterior de once columnas.
- Se protege tambien el borrado de ECAs con capturas de balance, para no convertir esa relacion nueva en un error de clave foranea sin mensaje comprensible.

### Verificacion posterior

- Builds de backend y frontend correctos. Vite mantiene una advertencia de tamano de chunk; no impide compilar.
- Suite unitaria backend: **179 pruebas aprobadas**. Tras endurecer el rechazo de placa null se revalidaron las 17 pruebas del dominio de caracterizacion y el build.
- Suite frontend: **99 pruebas aprobadas**, incluidas capturas desde el panel, campos inicialmente vacios, confirmacion de ceros, errores visibles, conversiones y generacion/lectura de un XLSX binario real.
- E2E: **33 casos de 7 suites con datos propios aprobados en las ejecuciones y revalidaciones**. La primera corrida encontro una expectativa antigua del mensaje de borrado de ECA; se ajusto por la nueva relacion y sus 8 casos se reejecutaron correctamente. Las suites mensual/caracterizacion se revalidaron despues del ajuste de placa null; finalmente se aprobaron los 9 casos mensuales, incluido inventario historico con mes omitido.
- La suite [app.e2e-spec.ts](../backend/test/app.e2e-spec.ts) **no se ejecuto** porque usa cuentas preexistentes y modifica sus sesiones; se priorizo la restriccion de no modificar datos del usuario. Por eso no se declara una ejecucion integral de todos los e2e del repositorio.
- Las suites crean y limpian sus propios registros. Los e2e preexistentes de reportes consumen numeros de las secuencias al generar comprobantes; no se reiniciaron ni corrigieron secuencias. La nueva suite mensual usa un numero de reporte explicito en sus datos sinteticos y no reserva numeros visibles de reporte.
- No se probo interfaz en navegador, escaner, facturacion DIAN ni cargue SUI. No se instalaron dependencias.
- Prisma requirio detener el PID 25808 del API en puerto 3000 para regenerar su motor bloqueado. En la primera comprobacion aun no habia servicio; posteriormente el supervisor lo reinicio con PID 16580. **Verificacion final: API existente respondiendo**, nueva ruta y placa documentadas en Swagger, y consulta anonima rechazada con HTTP 401. No se levanto otro servidor. Las instancias e2e se cerraron al terminar.
- Estado final de Prisma: 13 migraciones, esquema actualizado. Linter frontend sin errores; conserva una advertencia en el efecto preexistente de `RecuperadorForm`, fuera del cambio de placa.

### Pendientes para afirmar conformidad normativa

Persisten BM-04 a BM-09 en su alcance no capturado, identificacion y movimientos CAT detallados, evidencia verificable de compradores/facturas y rechazos, inventario fisico inicial, validacion de RUPS/APS/NUECA, politica y pruebas de tratamiento de datos, y el anexo tecnico vigente SUI. Ninguno se declara cumplido por tener un cuadre aritmetico correcto.

README y solicitudes HTTP pendientes de actualizacion cuando el usuario solicite documentacion general.

## 11. Ajuste visual a la imagen del formato de ingresos

El usuario suministro la imagen completa de las once columnas. Por su ajuste posterior, la exportacion conserva ese orden pero omite las filas de numeracion e instrucciones: incluye unicamente los encabezados en la primera fila y los datos desde la segunda. Se reproduce la tabla con fondo blanco, bordes negros, texto ajustado y la fila de encabezados inmovilizada; las cantidades se mantienen en toneladas. La hoja Novedades permanece separada. El panel y la exportacion mensual interna ya no se muestran en Balance de Masas.

La imagen respalda como referencia proporcionada: semanas enteras 1-5, identificacion CC=1/CE=2/pasaporte=3/NIT=4, rechazo no superior a la cantidad del ingreso, destino 1=relleno sanitario/2=estacion de transferencia y numero unico del sitio asignado por SUI. **No acredita la vigencia del anexo oficial ni define como calcular los limites de cada semana.** Se mantiene el calculo por tramos existente, sin presentarlo como validacion normativa nueva.

Por confirmacion posterior del usuario, la columna 6 de la tabla y del Excel muestra la placa habitual actual de Caracterizar Recuperador, sin espacios ni guiones. La API la expone como `recuperador.placa_habitual` y Novedades advierte por registro que no confirma el vehiculo historico de ese ingreso. Si falta, la celda permanece vacia. Esta decision sustituye el criterio anterior de no usar la placa habitual en la exportacion, pero no modifica reportes ni acredita trazabilidad historica.

No se completan rechazo ni sitio de cada ingreso con los totales mensuales. Tampoco se elimina automaticamente el ultimo digito del NIT: falta distinguir si incluye digito de verificacion; se advierte en Novedades. La captura/asignacion de datos faltantes por ingreso y el catalogo vigente de materiales siguen pendientes; el uso de la placa habitual no cierra la brecha de vehiculo por evento.
