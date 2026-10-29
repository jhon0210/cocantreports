import 'dotenv/config';
import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { CLOCK } from '../src/application/ports/clock.port';
import { AuthenticatedUser } from '../src/application/shared/authenticated-user';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { BalanceMasasModule } from '../src/presentation/balance-masas/balance-masas.module';
import { RecuperadoresModule } from '../src/presentation/recuperadores/recuperadores.module';
import { RolesGuard } from '../src/presentation/common/guards/roles.guard';

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: { today: () => new Date('2026-10-27T00:00:00Z') } }],
  exports: [CLOCK],
})
class TestClockModule {}

describe('Captura mensual (solo datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarioId: number;
  let ecaId: number;
  let ecaStockId: number;
  let materialId: number;
  let recuperadorId: number;
  let reporteId: number;
  const suffix = randomUUID();
  const http = () => request(app.getHttpServer());
  const role = (req: request.Test, perfil = 'Administrador') => req.set('x-test-role', perfil);
  const datos = () => ({
    periodo: '2026-09', id_eca: ecaId, id_mat: materialId,
    inventario_inicial_kg: 125, salidas_kg: 100, rechazos_kg: 25, entradas_cat_kg: 100,
    entradas_esperadas_kg: 200, soporte_salidas: 'Comprador sintetico; factura F-1',
    receptor_rechazos: 'Prestador sintetico; entrega R-1', mediciones_confirmadas: true, version: null,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, TestClockModule, BalanceMasasModule, RecuperadoresModule],
      providers: [RolesGuard, { provide: ConfigService, useValue: new ConfigService({ corsOrigins: [] }) }],
    }).compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    app.use((req: Request & { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = { id: usuarioId, usuario: suffix, nombre: 'Prueba', apellido: 'Mensual', idPerfil: 0, perfil: req.header('x-test-role') ?? 'Operario', idEca: null };
      next();
    });
    app.useGlobalGuards(module.get(RolesGuard, { strict: false }));
    await app.init();
    usuarioId = (await prisma.usuario.create({ data: { usuario: `mensual-${suffix}` } })).id_user;
    ecaId = (await prisma.eca.create({ data: { nomEca: `Mensual ${suffix}` } })).id_eca;
    ecaStockId = (await prisma.eca.create({ data: { nomEca: `Inventario ${suffix}` } })).id_eca;
    materialId = (await prisma.material.create({ data: { nomMaterial: `Mensual ${suffix}` } })).id_mat;
    recuperadorId = (await prisma.recuperador.create({ data: { nombre: 'Prueba', apellido: suffix, cedula: String(Date.now()), bancarizado: false } })).id_recuperador;
    for (const [mes, cantidad] of [['08', 100], ['09', 200]] as const) {
      const r = await prisma.reporte.create({ data: {
        numero_reporte: 0, id_eca: ecaId, id_mat: materialId, id_user: usuarioId, id_recuperador: recuperadorId,
        cantidad, valor: 1, FechaVenta: new Date(`2026-${mes}-10T00:00:00Z`),
      } });
      if (mes === '09') reporteId = r.consecutivo;
    }
  });

  afterAll(async () => {
    if (prisma && usuarioId) {
      await prisma.balanceMensual.deleteMany({ where: { id_user: usuarioId } });
      await prisma.reporte.deleteMany({ where: { id_user: usuarioId } });
      if (recuperadorId) await prisma.recuperador.delete({ where: { id_recuperador: recuperadorId } });
      if (ecaId) await prisma.eca.delete({ where: { id_eca: ecaId } });
      if (ecaStockId) await prisma.eca.delete({ where: { id_eca: ecaStockId } });
      if (materialId) await prisma.material.delete({ where: { id_mat: materialId } });
      await prisma.usuario.delete({ where: { id_user: usuarioId } });
    }
    if (app) await app.close();
  });

  it('solo permite consultar y guardar a administrador y coordinador', async () => {
    for (const perfil of ['Operario', 'Administrador Eca']) {
      await role(http().get('/balance-masas?periodo=2026-09'), perfil).expect(403);
      await role(http().put('/balance-masas'), perfil).send(datos()).expect(403);
    }
    await role(http().get('/balance-masas?periodo=2026-09'), 'Coordinador').expect(200);
  });

  it('valida periodo, pesos, confirmacion, soportes y campos desconocidos', async () => {
    await role(http().get('/balance-masas?periodo=2026-13')).expect(400);
    await role(http().get('/balance-masas?periodo=2026-11')).expect(400);
    for (const cambios of [
      { salidas_kg: -1 }, { rechazos_kg: 0.0001 }, { mediciones_confirmadas: false },
      { soporte_salidas: '' }, { receptor_rechazos: '' }, { entradas_cat_kg: 201 },
      { id_user: usuarioId }, { inventario_inicial_kg: null }, { version: undefined },
    ]) await role(http().put('/balance-masas')).send({ ...datos(), ...cambios }).expect(400);
  });

  it('guarda primer periodo, concilia el siguiente y persiste referencias y version', async () => {
    await role(http().put('/balance-masas')).send({
      ...datos(), periodo: '2026-08', inventario_inicial_kg: 50, entradas_esperadas_kg: 100,
      salidas_kg: 20, rechazos_kg: 5, entradas_cat_kg: 0,
    }).expect(204);
    await role(http().put('/balance-masas'), 'Coordinador').send(datos()).expect(204);
    const { body } = await role(http().get(`/balance-masas?periodo=2026-09&id_eca=${ecaId}`)).expect(200);
    expect(body[0]).toMatchObject({ entradas_kg: 200, inventario_anterior_kg: 125, inventario_final_kg: 200, novedades: [], captura: { version: 1, soporte_salidas: 'Comprador sintetico; factura F-1' } });
  });

  it('rechaza duplicado, version obsoleta y ruptura del inventario previo', async () => {
    await role(http().put('/balance-masas')).send(datos()).expect(409);
    await role(http().put('/balance-masas')).send({ ...datos(), version: 1, inventario_inicial_kg: 124 }).expect(400);
    await role(http().put('/balance-masas')).send({ ...datos(), version: 1, observaciones: 'Correccion propia' }).expect(204);
    await role(http().put('/balance-masas')).send({ ...datos(), version: 1 }).expect(409);
  });

  it('incluye saldo previo aun sin nuevas recepciones y nunca inventa ceros de captura', async () => {
    const { body } = await role(http().get(`/balance-masas?periodo=2026-10&id_eca=${ecaId}`)).expect(200);
    expect(body[0]).toMatchObject({ entradas_kg: 0, inventario_anterior_kg: 200, inventario_final_kg: null, captura: null });
  });

  it('detecta entradas editadas desde la captura y rechaza guardar contra consulta vieja', async () => {
    await prisma.reporte.update({ where: { consecutivo: reporteId }, data: { cantidad: 201 } });
    const { body } = await role(http().get(`/balance-masas?periodo=2026-09&id_eca=${ecaId}`)).expect(200);
    expect(body[0].novedades.join(' ')).toContain('entradas cambiaron');
    await role(http().put('/balance-masas')).send({ ...datos(), version: 2 }).expect(409);
    await prisma.reporte.update({ where: { consecutivo: reporteId }, data: { cantidad: 200 } });
  });

  it('protege ECA con solo inventario, sin generar fallo de clave foranea', async () => {
    await role(http().put('/balance-masas')).send({
      ...datos(), periodo: '2026-08', id_eca: ecaStockId, inventario_inicial_kg: 10, entradas_esperadas_kg: 0,
      salidas_kg: 0, rechazos_kg: 0, entradas_cat_kg: null,
    }).expect(204);
    await role(http().delete(`/ecas/${ecaStockId}`)).expect(409);
  });

  it('no oculta un material con inventario historico si se omite un mes de captura', async () => {
    const { body } = await role(http().get(`/balance-masas?periodo=2026-10&id_eca=${ecaStockId}`)).expect(200);
    expect(body[0]).toMatchObject({ id_mat: materialId, entradas_kg: 0, captura: null, inventario_anterior_kg: null, inventario_final_kg: null });
    expect(body[0].novedades.join(' ')).toContain('Sin captura del mes anterior');
  });

  it('guarda placa habitual opcional en caracterizacion y no modifica los reportes', async () => {
    const antes = await prisma.reporte.findUniqueOrThrow({ where: { consecutivo: reporteId } });
    const { body } = await role(http().patch(`/recuperadores/${recuperadorId}`)).send({
      caracterizacion: { fecha_inscripcion: '2026-10-27', tipo_documento: 'CC', placa_habitual: ' abc123 ' },
    }).expect(200);
    expect(body.caracterizacion.placa_habitual).toBe('ABC123');
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({
      caracterizacion: { fecha_inscripcion: '2026-10-27', tipo_documento: 'CC', placa_habitual: null },
    }).expect(400);
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({
      caracterizacion: { fecha_inscripcion: '2026-10-27', tipo_documento: 'CC' },
    }).expect(200);
    expect((await prisma.reporte.findUniqueOrThrow({ where: { consecutivo: reporteId } }))).toEqual(antes);
  });
});
