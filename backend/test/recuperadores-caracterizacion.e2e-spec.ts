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

describe('Recuperadores: formato de caracterización (HTTP + BD, datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: number[] = [];
  const cedulas: string[] = [];
  const suffix = randomUUID().slice(0, 10);
  const clave = 'Prueba123*';
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const nuevaCedula = () => {
    const cedula = `9${Date.now()}${cedulas.length}`.slice(0, 15);
    cedulas.push(cedula);
    return cedula;
  };
  const completa = {
    fecha_inscripcion: '2026-01-15', lugar: 'Medellín, Antioquia', pertenece_organizacion: true,
    organizacion_nombre: 'Asociación Prueba', tipo_documento: 'CC', fecha_nacimiento: '1980-05-20', genero: 'Femenino',
    estrato: '2', telefono: '3001234567', discapacidad: false, victima_conflicto: true, ruv: true,
    dependientes_total: 3, dependientes_menores: 2, experiencia_anios: 12, jornada: 'Mixta',
    transporte: ['Carretilla manual', 'Otro'], transporte_otro: 'Bicicleta', epp: 'A veces',
    materiales: ['Vidrio', 'Otros'], materiales_otros: 'Madera', autoriza_datos: true,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const hash = await module.get<PasswordHasher>(PASSWORD_HASHER).hash(clave);
    for (const [key, perfil] of [['admin', RoleName.ADMINISTRADOR], ['coord', RoleName.COORDINADOR], ['oper', RoleName.OPERARIO]] as const) {
      const rol = await prisma.rol.findUniqueOrThrow({ where: { perfil } });
      const user = await prisma.usuario.create({ data: { usuario: `${key}-${suffix}`, clave: hash, nomUser: 'Prueba', apeUser: suffix, id_perfil: rol.id_perfil } });
      userIds.push(user.id_user);
      const login = await http().post('/auth/login').send({ usuario: user.usuario, clave }).expect(200);
      tokens[key] = login.body.access_token;
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (cedulas.length) await prisma.recuperador.deleteMany({ where: { cedula: { in: cedulas } } });
      if (userIds.length) {
        await prisma.refreshToken.deleteMany({ where: { id_user: { in: userIds } } });
        await prisma.usuario.deleteMany({ where: { id_user: { in: userIds } } });
      }
    }
    if (app) await app.close();
  });

  const post = (role: string, body: object) => http().post('/recuperadores').auth(tokens[role], { type: 'bearer' }).send(body);

  it('guarda y devuelve la caracterización completa y el código único', async () => {
    const created = await post('coord', { nombre: 'Ana', apellido: suffix, cedula: nuevaCedula(), bancarizado: true, codigo_registro: `REC-${suffix}`, caracterizacion: completa }).expect(201);
    expect(created.body).toMatchObject({ codigo_registro: `REC-${suffix}`, caracterizacion: completa });
    const detail = await http().get(`/recuperadores/${created.body.id_recuperador}`).auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(detail.body.caracterizacion).toEqual(completa);
    const list = await http().get('/recuperadores').auth(tokens.admin, { type: 'bearer' }).expect(200);
    expect(list.body.find((r: { id_recuperador: number }) => r.id_recuperador === created.body.id_recuperador).caracterizacion).toEqual(completa);
  });

  it('valida opciones, reglas entre campos, autorización y duplicados sin guardar datos inválidos', async () => {
    const base = { nombre: 'Luis', apellido: suffix, bancarizado: false };
    const cedula = nuevaCedula();
    const invalidos = [
      { ...completa, genero: 'Inventado' },
      { ...completa, tipo_documento: 'Otro' },
      { ...completa, organizacion_nombre: undefined },
      { ...completa, fecha_nacimiento: '2999-01-01' },
      { ...completa, telefono: 'abc' },
      { ...completa, dependientes_total: -1 },
      { ...completa, campo_extra: 'x' },
      { ...completa, autoriza_datos: false },
    ];
    for (const caracterizacion of invalidos) await post('admin', { ...base, cedula, caracterizacion }).expect(400);
    await post('admin', { ...base, cedula, codigo_registro: 'con espacios', caracterizacion: completa }).expect(400);
    expect(await prisma.recuperador.count({ where: { cedula } })).toBe(0);

    await post('admin', { ...base, cedula, codigo_registro: `DUP-${suffix}`, caracterizacion: completa }).expect(201);
    await post('admin', { ...base, cedula: nuevaCedula(), codigo_registro: `DUP-${suffix}`, caracterizacion: completa }).expect(409);
    await post('oper', { ...base, cedula: nuevaCedula(), caracterizacion: completa }).expect(403);
  });

  it('edita reemplazando la caracterización, limpia dependientes y permite quitar el código', async () => {
    const cedula = nuevaCedula();
    const created = await post('admin', { nombre: 'Eva', apellido: suffix, cedula, bancarizado: false, codigo_registro: `EDT-${suffix}`, caracterizacion: completa }).expect(201);
    const url = `/recuperadores/${created.body.id_recuperador}`;
    const cambios = { ...completa, pertenece_organizacion: false, autoriza_datos: false };
    const updated = await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ codigo_registro: null, caracterizacion: cambios }).expect(200);
    expect(updated.body.codigo_registro).toBeNull();
    expect(updated.body.caracterizacion).not.toHaveProperty('organizacion_nombre');
    expect(updated.body.caracterizacion).toMatchObject({ pertenece_organizacion: false, autoriza_datos: false, lugar: 'Medellín, Antioquia' });
    await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ caracterizacion: null }).expect(400);
    await http().patch(url).auth(tokens.oper, { type: 'bearer' }).send({ nombre: 'X' }).expect(403);
    const sinCambios = await http().patch(url).auth(tokens.coord, { type: 'bearer' }).send({ nombre: 'Eva María' }).expect(200);
    expect(sinCambios.body.caracterizacion).toEqual(updated.body.caracterizacion);
  });

  it('los recuperadores sin formato siguen funcionando', async () => {
    const created = await post('admin', { nombre: 'Sin', apellido: suffix, cedula: nuevaCedula(), bancarizado: false }).expect(201);
    expect(created.body).toMatchObject({ caracterizacion: null, codigo_registro: null });
  });
});
