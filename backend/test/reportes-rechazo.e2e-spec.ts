import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PASSWORD_HASHER, PasswordHasher } from '../src/application/ports/password-hasher.port';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RoleName } from '../src/shared/constants/roles';

describe('Reportes: registros de rechazo (HTTP + BD, datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: number;
  let recuperadorId: number;
  let token: string;
  let idEca: number;
  let idMat: number;
  const suffix = randomUUID().slice(0, 10);
  const clave = 'Prueba123*';
  const cedula = `8${Date.now()}`.slice(0, 15);
  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.auth(token, { type: 'bearer' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const hash = await module.get<PasswordHasher>(PASSWORD_HASHER).hash(clave);
    const rol = await prisma.rol.findUniqueOrThrow({ where: { perfil: RoleName.ADMINISTRADOR } });
    const user = await prisma.usuario.create({ data: { usuario: `rech-${suffix}`, clave: hash, nomUser: 'Prueba', apeUser: suffix, id_perfil: rol.id_perfil } });
    userId = user.id_user;
    token = (await http().post('/auth/login').send({ usuario: user.usuario, clave }).expect(200)).body.access_token;
    recuperadorId = (await prisma.recuperador.create({ data: { nombre: 'Rec', apellido: suffix, cedula, id_estado: 1 } })).id_recuperador;
    idEca = (await prisma.eca.findFirstOrThrow({ select: { id_eca: true } })).id_eca;
    idMat = (await prisma.material.findFirstOrThrow({ select: { id_mat: true } })).id_mat;
  });

  afterAll(async () => {
    if (prisma) {
      if (userId) {
        await prisma.reporte.deleteMany({ where: { id_user: userId } });
        await prisma.refreshToken.deleteMany({ where: { id_user: userId } });
      }
      if (recuperadorId) await prisma.recuperador.deleteMany({ where: { id_recuperador: recuperadorId } });
      if (userId) await prisma.usuario.deleteMany({ where: { id_user: userId } });
    }
    if (app) await app.close();
  });

  const venta = () => ({ id_recuperador: recuperadorId, id_mat: idMat, id_eca: idEca, cantidad: 10, valor: 500 });
  const rechazo = (rechazo_kg: unknown) => ({ id_recuperador: recuperadorId, id_mat: idMat, id_eca: idEca, tipo: 'RECHAZO', rechazo_kg });

  it('guarda venta y rechazo en un comprobante; el rechazo no suma cantidad ni valor', async () => {
    const res = await auth(http().post('/reportes/lote')).send({ registros: [venta(), rechazo(3.5)] }).expect(201);
    expect(res.body[0]).toMatchObject({ tipo: 'VENTA', cantidad: 10, rechazo_kg: 0, subtotal: 5000 });
    expect(res.body[1]).toMatchObject({ tipo: 'RECHAZO', cantidad: 0, valor: 0, rechazo_kg: 3.5, subtotal: 0 });
    expect(res.body[1].numero_reporte).toBe(res.body[0].numero_reporte);

    const filas = await auth(http().get('/reportes/balance-masas')).query({ id_eca: idEca, limit: 200 }).expect(200);
    const propios = filas.body.filter((r: { id_recuperador: number }) => r.id_recuperador === recuperadorId);
    expect(propios.map((r: { rechazo_kg: number }) => r.rechazo_kg).sort()).toEqual([0, 3.5]);
  });

  it('valida el rechazo y edita sus kilogramos', async () => {
    await auth(http().post('/reportes')).send(rechazo(0)).expect(400);
    await auth(http().post('/reportes')).send(rechazo(undefined)).expect(400);
    const creado = await auth(http().post('/reportes')).send(rechazo(2)).expect(201);
    const editado = await auth(http().put(`/reportes/${creado.body.consecutivo}`)).send({ id_mat: idMat, id_eca: idEca, tipo: 'RECHAZO', rechazo_kg: 4 }).expect(200);
    expect(editado.body).toMatchObject({ tipo: 'RECHAZO', rechazo_kg: 4, cantidad: 0, valor: 0 });
  });

  it('la BD rechaza combinaciones incoherentes de rechazo, cantidad y valor', async () => {
    const base = { id_mat: idMat, id_eca: idEca, id_user: userId, id_recuperador: recuperadorId };
    await expect(prisma.reporte.create({ data: { ...base, cantidad: 0, valor: 500, rechazo_kg: 2 } })).rejects.toThrow();
    await expect(prisma.reporte.create({ data: { ...base, cantidad: 0, valor: 0, rechazo_kg: 0 } })).rejects.toThrow();
    await expect(prisma.reporte.create({ data: { ...base, cantidad: 0, valor: 0, rechazo_kg: -1 } })).rejects.toThrow();
  });
});
