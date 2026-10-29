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

describe('Perfil Administrador Eca (HTTP + BD, datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: number[] = [];
  const ecaIds: number[] = [];
  const reporteIds: number[] = [];
  const suffix = randomUUID().slice(0, 10);
  const clave = 'Prueba123*';
  const tokens: Record<string, string> = {};
  let rolEca: number;
  let rolOperario: number;
  let materialId: number;
  let recuperadorId: number;
  const http = () => request(app.getHttpServer());
  const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
  const base = (usuario: string, cedula: number) => ({
    nomUser: 'Prueba', apeUser: suffix, usuario, clave, cedula,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const hash = await module.get<PasswordHasher>(PASSWORD_HASHER).hash(clave);
    for (const [key, perfil] of [['coord', RoleName.COORDINADOR], ['oper', RoleName.OPERARIO]] as const) {
      const rol = await prisma.rol.findUniqueOrThrow({ where: { perfil } });
      if (key === 'oper') rolOperario = rol.id_perfil;
      const user = await prisma.usuario.create({ data: { usuario: `${key}-eca-${suffix}`, clave: hash, nomUser: 'Prueba', apeUser: suffix, id_perfil: rol.id_perfil } });
      userIds.push(user.id_user);
      tokens[key] = (await http().post('/auth/login').send({ usuario: user.usuario, clave }).expect(200)).body.access_token;
    }
    rolEca = (await prisma.rol.findUniqueOrThrow({ where: { perfil: RoleName.ADMINISTRADOR_ECA } })).id_perfil;
    for (const label of ['a', 'b']) ecaIds.push((await prisma.eca.create({ data: { nomEca: `Admin ECA ${label} ${suffix}` } })).id_eca);
    materialId = (await prisma.material.create({ data: { nomMaterial: `Prueba ${suffix}` } })).id_mat;
    recuperadorId = (await prisma.recuperador.create({ data: { nombre: 'Prueba', apellido: suffix, cedula: `8${Date.now()}`.slice(0, 15) } })).id_recuperador;
  });

  afterAll(async () => {
    if (prisma) {
      const ids = (await prisma.usuario.findMany({ where: { apeUser: suffix }, select: { id_user: true } })).map((u) => u.id_user);
      await prisma.reporte.deleteMany({ where: { OR: [{ consecutivo: { in: reporteIds } }, { id_user: { in: ids } }] } });
      await prisma.refreshToken.deleteMany({ where: { id_user: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id_user: { in: ids } } });
      if (recuperadorId) await prisma.recuperador.delete({ where: { id_recuperador: recuperadorId } });
      if (materialId) await prisma.material.delete({ where: { id_mat: materialId } });
      await prisma.eca.deleteMany({ where: { id_eca: { in: ecaIds } } });
    }
    if (app) await app.close();
  });

  it('exige una ECA existente para el perfil y no la admite en otros perfiles', async () => {
    const post = (body: object) => http().post('/usuarios').set(auth('coord')).send(body);
    await post({ ...base(`sin-eca-${suffix}`, 910000001), id_perfil: rolEca }).expect(400);
    await post({ ...base(`eca-falsa-${suffix}`, 910000002), id_perfil: rolEca, id_eca: 2147483000 }).expect(404);
    await post({ ...base(`oper-eca-${suffix}`, 910000003), id_perfil: rolOperario, id_eca: ecaIds[0] }).expect(400);
    expect(await prisma.usuario.count({ where: { apeUser: suffix, usuario: { startsWith: 'sin-eca' } } })).toBe(0);

    const created = await post({ ...base(`eca-${suffix}`, 910000004), id_perfil: rolEca, id_eca: ecaIds[0] }).expect(201);
    expect(created.body).toMatchObject({ perfil: 'Administrador Eca', id_eca: ecaIds[0], eca: `Admin ECA a ${suffix}` });
    userIds.push(created.body.id_user);
    await http().post('/usuarios').set(auth('oper')).send({ ...base(`x-${suffix}`, 910000005), id_perfil: rolEca, id_eca: ecaIds[0] }).expect(403);
  });

  it('cambia la ECA al editar y la retira al cambiar de perfil', async () => {
    const created = await http().post('/usuarios').set(auth('coord')).send({ ...base(`edit-${suffix}`, 910000006), id_perfil: rolEca, id_eca: ecaIds[0] }).expect(201);
    const url = `/usuarios/${created.body.id_user}`;
    const moved = await http().patch(url).set(auth('coord')).send({ id_eca: ecaIds[1] }).expect(200);
    expect(moved.body.id_eca).toBe(ecaIds[1]);
    const renamed = await http().patch(url).set(auth('coord')).send({ nomUser: 'Otro' }).expect(200);
    expect(renamed.body.id_eca).toBe(ecaIds[1]);
    await http().patch(url).set(auth('coord')).send({ id_perfil: rolOperario }).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ perfil: 'Operario', id_eca: null, eca: null });
    });
    await http().patch(url).set(auth('coord')).send({ id_perfil: rolEca }).expect(400);
    await http().patch(url).set(auth('coord')).send({ id_perfil: rolEca, id_eca: ecaIds[0] }).expect(200);
  });

  it('solo registra ventas en su ECA, no consulta reportes y se desasocia si se elimina la ECA', async () => {
    const user = await http().post('/usuarios').set(auth('coord')).send({ ...base(`venta-${suffix}`, 910000007), id_perfil: rolEca, id_eca: ecaIds[0] }).expect(201);
    const login = await http().post('/auth/login').send({ usuario: `venta-${suffix}`, clave }).expect(200);
    expect(login.body.user).toMatchObject({ perfil: 'Administrador Eca', id_eca: ecaIds[0] });
    tokens.eca = login.body.access_token;
    const venta = { id_recuperador: recuperadorId, id_mat: materialId, cantidad: 0, valor: 1000 };

    const saved = await http().post('/reportes').set(auth('eca')).send({ ...venta, id_eca: ecaIds[0] }).expect(201);
    reporteIds.push(saved.body.consecutivo);
    await http().post('/reportes').set(auth('eca')).send({ ...venta, id_eca: ecaIds[1] }).expect(403);
    await http().get('/reportes').set(auth('eca')).expect(403);
    await http().get(`/reportes/${saved.body.consecutivo}/comprobante`).set(auth('eca')).expect(403);
    await http().get('/recuperadores').set(auth('eca')).expect(403);
    await http().get('/usuarios').set(auth('eca')).expect(403);
    await http().get('/ecas').set(auth('eca')).expect(200);

    await prisma.eca.delete({ where: { id_eca: ecaIds[1] } });
    await http().patch(`/usuarios/${user.body.id_user}`).set(auth('coord')).send({ id_eca: ecaIds[1] }).expect(404);
    await prisma.reporte.delete({ where: { consecutivo: saved.body.consecutivo } });
    await prisma.eca.delete({ where: { id_eca: ecaIds[0] } });
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id_user: user.body.id_user } })).id_eca).toBeNull();
    await http().post('/reportes').set(auth('eca')).send({ ...venta, id_eca: ecaIds[0] }).expect(422);
  });
});
