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
import { RolesGuard } from '../src/presentation/common/guards/roles.guard';
import { ReportesModule } from '../src/presentation/reportes/reportes.module';
import { RecuperadoresModule } from '../src/presentation/recuperadores/recuperadores.module';

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: { today: () => new Date('2026-10-22T00:00:00Z') } }],
  exports: [CLOCK],
})
class TestClockModule {}

describe('Balance y documentos (datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ecaId: number;
  let materialId: number;
  let usuarioId: number;
  let recuperadorId: number;
  let numeroRegistro: number;
  const suffix = randomUUID();
  const cedula = String(Date.now());
  const contenido = Buffer.from('%PDF-1.4\nArchivo de prueba\n%%EOF');
  const documento = { tipo: 'identificacion', nombre: 'identidad.pdf', contenido: contenido.toString('base64') };
  const http = () => request(app.getHttpServer());
  const role = (req: request.Test, perfil = 'Administrador') => req.set('x-test-role', perfil);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, TestClockModule, ReportesModule, RecuperadoresModule],
      providers: [RolesGuard, { provide: ConfigService, useValue: new ConfigService({ corsOrigins: [] }) }],
    }).compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    app.use((req: Request & { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = { id: usuarioId, usuario: suffix, nombre: 'Prueba', apellido: 'Balance', idPerfil: 0, perfil: req.header('x-test-role') ?? 'Operario', idEca: null };
      next();
    });
    app.useGlobalGuards(module.get(RolesGuard, { strict: false }));
    await app.init();
    usuarioId = (await prisma.usuario.create({ data: { usuario: `balance-${suffix}` } })).id_user;
    ecaId = (await prisma.eca.create({ data: { nomEca: `Balance ${suffix}`, codigo_nuec: '1000000001', macroruta: '1000000002' } })).id_eca;
    materialId = (await prisma.material.create({ data: { nomMaterial: `Balance ${suffix}` } })).id_mat;
  });

  afterAll(async () => {
    if (prisma) {
      if (usuarioId) await prisma.reporte.deleteMany({ where: { id_user: usuarioId } });
      if (recuperadorId) await prisma.recuperador.delete({ where: { id_recuperador: recuperadorId } });
      if (ecaId) await prisma.eca.delete({ where: { id_eca: ecaId } });
      if (materialId) await prisma.material.delete({ where: { id_mat: materialId } });
      if (usuarioId) await prisma.usuario.delete({ where: { id_user: usuarioId } });
    }
    if (app) await app.close();
  });

  it('crea recuperador con documentos y los descarga solo con el perfil autorizado', async () => {
    const res = await role(http().post('/recuperadores')).send({
      nombre: 'Prueba', apellido: suffix, cedula, bancarizado: false,
      documentos: [documento], caracterizacion: { fecha_inscripcion: '2026-10-22', tipo_documento: 'CC', autoriza_datos: true },
    }).expect(201);
    recuperadorId = res.body.id_recuperador;
    expect(res.body.documentos).toHaveLength(1);
    expect(res.body.documentos[0]).not.toHaveProperty('contenido');
    const id = res.body.documentos[0].id;
    const downloaded = await role(http().get(`/recuperadores/${recuperadorId}/documentos/${id}`)).expect(200);
    expect(downloaded.body).toEqual(contenido);
    await role(http().get(`/recuperadores/${recuperadorId}/documentos/${id}`), 'Administrador Eca').expect(403);
    await role(http().get(`/recuperadores/${recuperadorId + 1000000}/documentos/${id}`)).expect(404);
  });

  it('sustituye y conserva documentos de manera atómica; rechaza archivos falsos', async () => {
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({ documentos: [{ ...documento, nombre: 'reemplazo.pdf' }] }).expect(200);
    const detail = await role(http().get(`/recuperadores/${recuperadorId}`)).expect(200);
    expect(detail.body.documentos[0].nombre).toBe('reemplazo.pdf');
    const id = detail.body.documentos[0].id;
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({ documentos: [{ id }] }).expect(200);
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({ documentos: [{ ...documento, contenido: 'bm8gZXMgcGRm' }] }).expect(400);
    await role(http().patch(`/recuperadores/${recuperadorId}`)).send({ documentos: null }).expect(400);
    expect((await role(http().get(`/recuperadores/${recuperadorId}`)).expect(200)).body.documentos[0].id).toBe(id);
  });

  it('guarda macroruta y devuelve los datos del balance con acceso exclusivo de administrador/coordinador', async () => {
    const creado = await role(http().post('/reportes')).send({
      id_mat: materialId, id_eca: ecaId, id_eca_macroruta: ecaId, id_recuperador: recuperadorId, cantidad: 1250, valor: 100,
    }).expect(201);
    numeroRegistro = creado.body.consecutivo;
    expect(creado.body.id_eca_macroruta).toBe(ecaId);
    expect(creado.body.macroruta.codigo).toBe('1000000002');
    for (const perfil of ['Administrador', 'Coordinador']) {
      const result = await role(http().get(`/reportes/balance-masas?id_eca=${ecaId}&ventaDesde=2026-10-01&ventaHasta=2026-10-31`), perfil).expect(200);
      expect(result.body[0]).toMatchObject({ consecutivo: numeroRegistro, eca: { codigo_nuec: '1000000001' }, recuperador: { tipo_documento: 'CC' } });
    }
    for (const perfil of ['Operario', 'Administrador Eca']) await role(http().get('/reportes/balance-masas'), perfil).expect(403);
    await role(http().get('/reportes/balance-masas?ventaDesde=2026-10-31&ventaHasta=2026-10-01')).expect(400);
    await role(http().put(`/reportes/${numeroRegistro}`)).send({ id_mat: materialId, id_eca: ecaId, id_eca_macroruta: null, cantidad: 1250, valor: 100 }).expect(200);
    expect((await role(http().get(`/reportes/${numeroRegistro}`)).expect(200)).body.macroruta).toBeNull();
  });
});
