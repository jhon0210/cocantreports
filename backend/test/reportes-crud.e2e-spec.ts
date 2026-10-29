import 'dotenv/config';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { configureApp } from '../src/app.setup';
import { CLOCK } from '../src/application/ports/clock.port';
import { AuthenticatedUser } from '../src/application/shared/authenticated-user';
import { NuevoReporte } from '../src/domain/reportes/reporte.entity';
import { REPORTE_REPOSITORY, ReporteRepository } from '../src/domain/reportes/reporte.repository';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RolesGuard } from '../src/presentation/common/guards/roles.guard';
import { ReportesModule } from '../src/presentation/reportes/reportes.module';
import { EcasModule } from '../src/presentation/ecas/ecas.module';

const today = new Date(Date.UTC(2026, 9, 14));

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: { now: () => today, today: () => today } }],
  exports: [CLOCK],
})
class TestClockModule {}

describe('Reportes: lote, comprobante y CRUD (HTTP + BD, datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: ReporteRepository;
  let ownerId: number;
  let otherId: number;
  let ecaId: number;
  let materialId: number;
  let recuperadorId: number;
  let ownedStateId: number | undefined;
  const suffix = randomUUID();
  const userIds: number[] = [];
  const extraEcaIds: number[] = [];
  const extraMaterialIds: number[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, TestClockModule, ReportesModule, EcasModule],
      providers: [RolesGuard, { provide: ConfigService, useValue: new ConfigService({ corsOrigins: [] }) }],
    }).compile();
    prisma = module.get(PrismaService);
    repository = module.get<ReporteRepository>(REPORTE_REPOSITORY);
    app = module.createNestApplication();
    configureApp(app);
    // Identidad de prueba: se comprueban los permisos reales sin usar sesiones ni usuarios del seeder.
    app.use((req: Request & { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = {
        id: req.header('x-test-owner') === 'other' ? otherId : ownerId,
        usuario: suffix,
        nombre: 'Prueba',
        apellido: 'Reporte',
        idPerfil: 0,
        perfil: req.header('x-test-role') ?? 'Operario',
        idEca: req.header('x-test-eca') ? Number(req.header('x-test-eca')) : null,
      };
      next();
    });
    app.useGlobalGuards(module.get(RolesGuard, { strict: false }));
    await app.init();

    for (const label of ['owner', 'other']) {
      const user = await prisma.usuario.create({ data: { usuario: `reportes-${label}-${suffix}` } });
      userIds.push(user.id_user);
    }
    [ownerId, otherId] = userIds;
    const eca = await prisma.eca.create({ data: { nomEca: `Prueba ${suffix}`, direccion: 'Temporal' } });
    ecaId = eca.id_eca;
    const material = await prisma.material.create({ data: { nomMaterial: `Prueba ${suffix}` } });
    materialId = material.id_mat;
    if (!(await prisma.estadoRecuperador.findUnique({ where: { id_estado: 1 } }))) {
      await prisma.estadoRecuperador.create({ data: { id_estado: 1, nombre: 'Activo' } });
      ownedStateId = 1;
    }
    const recuperador = await prisma.recuperador.create({
      data: { nombre: 'Prueba', apellido: suffix, cedula: `${Date.now()}` },
    });
    recuperadorId = recuperador.id_recuperador;
  });

  afterAll(async () => {
    if (prisma) {
      if (userIds.length) await prisma.reporte.deleteMany({ where: { id_user: { in: userIds } } });
      if (recuperadorId) await prisma.recuperador.delete({ where: { id_recuperador: recuperadorId } });
      if (materialId) await prisma.material.delete({ where: { id_mat: materialId } });
      if (extraMaterialIds.length) await prisma.material.deleteMany({ where: { id_mat: { in: extraMaterialIds } } });
      if (ecaId) await prisma.eca.delete({ where: { id_eca: ecaId } });
      if (extraEcaIds.length) await prisma.eca.deleteMany({ where: { id_eca: { in: extraEcaIds } } });
      if (userIds.length) await prisma.usuario.deleteMany({ where: { id_user: { in: userIds } } });
      if (ownedStateId) await prisma.estadoRecuperador.delete({ where: { id_estado: ownedStateId } });
    }
    if (app) await app.close();
  });

  const http = () => request(app.getHttpServer());
  const venta = () => ({ id_recuperador: recuperadorId, id_mat: materialId, id_eca: ecaId, cantidad: 2.5, valor: 1001, FechaVenta: '2026-10-14' });

  it('valida lotes vacios, anidados y fechas; no guarda datos invalidos', async () => {
    await http().post('/reportes/lote').send({ registros: [] }).expect(400);
    await http().post('/reportes/lote').send({ registros: [venta(), { ...venta(), valor: -1 }] }).expect(400);
    await http().post('/reportes/lote').send({ registros: [venta(), { ...venta(), FechaVenta: '2026-02-30' }] }).expect(400);
    expect(await prisma.reporte.count({ where: { id_user: ownerId } })).toBe(0);
  });

  it('revierte toda la transaccion si un registro falla en persistencia', async () => {
    const data = {
      idMat: materialId, idEca: ecaId, idUser: ownerId, idRecuperador: recuperadorId,
      cantidad: 2.5, valor: 1001, fechaRegistro: today, fechaVenta: today,
    };
    await expect(repository.createBatch([NuevoReporte.crear(data), NuevoReporte.crear({ ...data, idMat: 2147483647 })]))
      .rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.reporte.count({ where: { id_user: ownerId } })).toBe(0);
  });

  it('guarda un comprobante completo, controla roles, edita sin cambiar autor y elimina solo el registro elegido', async () => {
    await http().post('/reportes/lote').set('x-test-role', 'Coordinador').send({ registros: [venta()] }).expect(201);
    await http().post('/reportes').set('x-test-role', 'Coordinador').send(venta()).expect(201);
    const response = await http().post('/reportes/lote').send({ registros: [venta(), { ...venta(), cantidad: 3 }] }).expect(201);
    const [first, second] = response.body;
    expect(response.body).toHaveLength(2);
    expect(first).toMatchObject({ id_user: ownerId, subtotal: 2503, FechaVenta: '2026-10-14' });
    expect(first.comprobante).toEqual(expect.any(String));
    expect(second.comprobante).toBe(first.comprobante);
    await http().get(`/reportes/${first.consecutivo}/comprobante`).set('x-test-owner', 'other').expect(404);
    const grouped = await http().get(`/reportes/${first.consecutivo}/comprobante`).expect(200);
    expect(grouped.body).toHaveLength(2);

    const changes = { id_mat: materialId, id_eca: ecaId, cantidad: 4, valor: 1200, FechaVenta: '2026-10-13' };
    await http().put(`/reportes/${first.consecutivo}`).set('x-test-role', 'Operario').send(changes).expect(403);
    for (const role of ['Operario', 'Coordinador']) {
      await http().delete(`/reportes/${first.consecutivo}`).set('x-test-role', role).expect(403);
    }
    const coordinated = await http().put(`/reportes/${first.consecutivo}`).set('x-test-role', 'Coordinador').set('x-test-owner', 'other').send(changes).expect(200);
    expect(coordinated.body).toMatchObject({ cantidad: 4, id_user: ownerId, comprobante: first.comprobante });
    const updated = await http().put(`/reportes/${first.consecutivo}`).set('x-test-role', 'Administrador').set('x-test-owner', 'other').send(changes).expect(200);
    expect(updated.body).toMatchObject({ cantidad: 4, subtotal: 4800, id_user: ownerId, id_recuperador: recuperadorId, comprobante: first.comprobante, FechaRegistro: '2026-10-14' });
    await http().put(`/reportes/${first.consecutivo}`).set('x-test-role', 'Administrador').send({ ...changes, FechaVenta: '2999-01-01' }).expect(400);
    await http().delete(`/reportes/${first.consecutivo}`).set('x-test-role', 'Administrador').expect(204);
    const remaining = await http().get(`/reportes/${second.consecutivo}/comprobante`).expect(200);
    expect(remaining.body).toHaveLength(1);
    expect(remaining.body[0].comprobante).toBe(first.comprobante);
    await http().delete(`/reportes/${first.consecutivo}`).set('x-test-role', 'Administrador').expect(404);
  });

  it('acepta cero kg en venta, lote y edición; rechaza negativos incluso en la BD', async () => {
    const single = await http().post('/reportes').send({ ...venta(), cantidad: 0 }).expect(201);
    expect(single.body).toMatchObject({ cantidad: 0, subtotal: 0 });
    const batch = await http().post('/reportes/lote').send({ registros: [{ ...venta(), cantidad: 0 }] }).expect(201);
    expect(batch.body[0]).toMatchObject({ cantidad: 0, subtotal: 0 });
    const edited = await http().put(`/reportes/${single.body.consecutivo}`).set('x-test-role', 'Coordinador').send({ ...venta(), id_recuperador: undefined, cantidad: 0 }).expect(200);
    expect(edited.body).toMatchObject({ cantidad: 0, subtotal: 0 });
    await http().post('/reportes').send({ ...venta(), cantidad: -0.001 }).expect(400);
    await expect(prisma.reporte.update({ where: { consecutivo: single.body.consecutivo }, data: { cantidad: -1 } })).rejects.toThrow();
    expect((await prisma.reporte.findUniqueOrThrow({ where: { consecutivo: single.body.consecutivo } })).cantidad).toBe(0);
  });

  it('filtra por material y fechas con paginación, manteniendo la restricción de reportes propios', async () => {
    const material = await prisma.material.create({ data: { nomMaterial: `Filtro ${suffix}` } });
    extraMaterialIds.push(material.id_mat);
    const target = { ...venta(), id_mat: material.id_mat };
    const first = await http().post('/reportes').send(target).expect(201);
    const second = await http().post('/reportes').send(target).expect(201);
    const foreign = await http().post('/reportes').set('x-test-owner', 'other').send(target).expect(201);
    await http().post('/reportes').send({ ...target, FechaVenta: '2026-10-01' }).expect(201);
    const filters = { id_mat: material.id_mat, ventaDesde: '2026-10-14', ventaHasta: '2026-10-14' };
    const own = await http().get('/reportes').query(filters).expect(200);
    expect(own.body.map((r: { consecutivo: number }) => r.consecutivo)).toEqual([second.body.consecutivo, first.body.consecutivo]);
    const all = await http().get('/reportes').set('x-test-role', 'Coordinador').query(filters).expect(200);
    expect(all.body.map((r: { consecutivo: number }) => r.consecutivo)).toEqual([foreign.body.consecutivo, second.body.consecutivo, first.body.consecutivo]);
    const page = await http().get('/reportes').query({ ...filters, limit: 1, offset: 1 }).expect(200);
    expect(page.body.map((r: { consecutivo: number }) => r.consecutivo)).toEqual([first.body.consecutivo]);
    for (const id_mat of ['texto', 0, -1, 1.5]) await http().get('/reportes').query({ id_mat }).expect(400);
  });

  it('asigna un número de reporte consecutivo por comprobante, compartido por todas sus líneas', async () => {
    const lote = await http().post('/reportes/lote').send({ registros: [venta(), { ...venta(), cantidad: 1 }] }).expect(201);
    expect(lote.body[0].numero_reporte).toEqual(expect.any(Number));
    expect(lote.body[1].numero_reporte).toBe(lote.body[0].numero_reporte);
    const siguiente = await http().post('/reportes').send(venta()).expect(201);
    expect(siguiente.body.numero_reporte).toBe(lote.body[0].numero_reporte + 1);
    const otro = await http().post('/reportes/lote').send({ registros: [venta()] }).expect(201);
    expect(otro.body[0].numero_reporte).toBe(siguiente.body.numero_reporte + 1);
    const lista = await http().get('/reportes').query({ limit: 200 }).expect(200);
    expect(lista.body.find((r: { consecutivo: number }) => r.consecutivo === lote.body[0].consecutivo).numero_reporte).toBe(lote.body[0].numero_reporte);
  });

  it('el Administrador Eca solo crea reportes en su ECA asociada y no consulta los guardados', async () => {
    const otraEca = await prisma.eca.create({ data: { nomEca: `Otra ${suffix}` } });
    extraEcaIds.push(otraEca.id_eca);
    const eca = (id: number | null) => (id === null ? {} : { 'x-test-eca': String(id) });
    const post = (body: object, id: number | null) => http().post('/reportes').set('x-test-role', 'Administrador Eca').set(eca(id)).send(body);

    const propia = await post({ ...venta(), id_eca: ecaId }, ecaId).expect(201);
    expect(propia.body.id_eca).toBe(ecaId);
    await http().post('/reportes/lote').set('x-test-role', 'Administrador Eca').set(eca(ecaId)).send({ registros: [{ ...venta(), id_eca: ecaId }] }).expect(201);
    await post({ ...venta(), id_eca: otraEca.id_eca }, ecaId).expect(403);
    await http().post('/reportes/lote').set('x-test-role', 'Administrador Eca').set(eca(ecaId))
      .send({ registros: [{ ...venta(), id_eca: ecaId }, { ...venta(), id_eca: otraEca.id_eca }] }).expect(403);
    await post({ ...venta(), id_eca: ecaId }, null).expect(422);
    for (const path of ['/reportes', `/reportes/${propia.body.consecutivo}`, `/reportes/${propia.body.consecutivo}/comprobante`]) {
      await http().get(path).set('x-test-role', 'Administrador Eca').set(eca(ecaId)).expect(403);
    }
    await http().put(`/reportes/${propia.body.consecutivo}`).set('x-test-role', 'Administrador Eca').set(eca(ecaId)).send({ id_mat: materialId, id_eca: ecaId, cantidad: 1, valor: 100 }).expect(403);
    await http().delete(`/reportes/${propia.body.consecutivo}`).set('x-test-role', 'Administrador Eca').set(eca(ecaId)).expect(403);
  });

  it('los reportes bloquean eliminar una ECA; un valor histórico del recuperador no la bloquea', async () => {
    const eca = await prisma.eca.create({ data: { nomEca: `Eliminar ${suffix}` } });
    extraEcaIds.push(eca.id_eca);
    // Solo se altera el recuperador creado por esta prueba.
    await prisma.$executeRaw`UPDATE recuperadores SET id_eca = ${eca.id_eca} WHERE id_recuperador = ${recuperadorId}`;
    const sale = await http().post('/reportes').send({ ...venta(), id_eca: eca.id_eca }).expect(201);
    const denied = await http().delete(`/ecas/${eca.id_eca}`).set('x-test-role', 'Administrador').expect(409);
    expect(denied.body.message).toBe('La ECA tiene reportes de ventas o balances vinculados y no se puede eliminar.');
    await http().delete(`/reportes/${sale.body.consecutivo}`).set('x-test-role', 'Administrador').expect(204);
    await http().delete(`/ecas/${eca.id_eca}`).set('x-test-role', 'Administrador').expect(204);
    expect(await prisma.recuperador.findUnique({ where: { id_recuperador: recuperadorId } })).not.toBeNull();
  });
});
