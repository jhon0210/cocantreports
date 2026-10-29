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

describe('Cambiar usuario de acceso (HTTP + BD, cuentas propias)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: number[] = [];
  const suffix = randomUUID().slice(0, 12);
  const clave = 'Prueba123*';
  const names = {
    admin: `admin-${suffix}`, coord: `coord-${suffix}`, oper: `oper-${suffix}`, target: `target-${suffix}`,
  };
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const hash = await module.get<PasswordHasher>(PASSWORD_HASHER).hash(clave);
    const roles = [RoleName.ADMINISTRADOR, RoleName.COORDINADOR, RoleName.OPERARIO, RoleName.OPERARIO];
    for (const [index, name] of Object.values(names).entries()) {
      const rol = await prisma.rol.findUniqueOrThrow({ where: { perfil: roles[index] } });
      const user = await prisma.usuario.create({
        data: { usuario: name, clave: hash, nomUser: 'Prueba', apeUser: suffix, id_perfil: rol.id_perfil },
      });
      ids.push(user.id_user);
    }
    for (const role of ['admin', 'coord', 'oper'] as const) {
      const result = await http().post('/auth/login').send({ usuario: names[role], clave }).expect(200);
      tokens[role] = result.body.access_token;
    }
  });

  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.refreshToken.deleteMany({ where: { id_user: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id_user: { in: ids } } });
    }
    if (app) await app.close();
  });

  it('respeta permisos y valida formato, duplicados y persistencia', async () => {
    const url = `/usuarios/${ids[3]}`;
    await http().patch(url).auth(tokens.oper, { type: 'bearer' }).send({ usuario: `denegado-${suffix}` }).expect(403);
    await http().patch(`/usuarios/${ids[0]}`).auth(tokens.coord, { type: 'bearer' }).send({ usuario: `denegado-${suffix}` }).expect(403);
    await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ usuario: names.admin }).expect(409);
    for (const usuario of ['', 'x', 'con espacios', 'a'.repeat(51)]) {
      await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ usuario }).expect(400);
    }
    const renamed = `renamed-${suffix}`;
    const result = await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ usuario: ` ${renamed} ` }).expect(200);
    expect(result.body).toMatchObject({ id_user: ids[3], usuario: renamed });
    expect(await prisma.usuario.findUnique({ where: { id_user: ids[3] } })).toMatchObject({ usuario: renamed });
    await http().post('/auth/login').send({ usuario: names.target, clave }).expect(401);
    const login = await http().post('/auth/login').send({ usuario: renamed, clave }).expect(200);
    expect(login.body.user.id_user).toBe(ids[3]);
  });

  it('permite cambiar el usuario propio y mantiene el perfil y la renovación de sesión por ID', async () => {
    const renamed = `admin-new-${suffix}`;
    await http().patch(`/usuarios/${ids[0]}`).auth(tokens.admin, { type: 'bearer' }).send({ usuario: renamed }).expect(200);
    const profile = await http().get('/auth/profile').auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(profile.body).toMatchObject({ id_user: ids[0], usuario: renamed, perfil: RoleName.ADMINISTRADOR });
    const login = await http().post('/auth/login').send({ usuario: renamed, clave }).expect(200);
    const cookies = login.headers['set-cookie'];
    if (!cookies) throw new Error('No se recibio la cookie de sesion');
    const refresh = await http().post('/auth/refresh').set('Cookie', cookies).expect(200);
    expect(refresh.body.user).toMatchObject({ id_user: ids[0], usuario: renamed, perfil: RoleName.ADMINISTRADOR });
  });
});
