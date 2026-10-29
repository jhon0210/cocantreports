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

function pdf(size: number): Buffer {
  const bytes = Buffer.alloc(size, 32);
  bytes.write('%PDF-1.7\n');
  bytes.write('\n%%EOF', size - 6);
  return bytes;
}

describe('ECA: campos normativos y PDF (HTTP + BD, datos propios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: number[] = [];
  const ecaIds: number[] = [];
  const suffix = randomUUID().slice(0, 10);
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const nombre = `ECA prueba ${suffix}`;
  const base = { nomEca: nombre, direccion: 'Calle 1, Medellín', representante: 'Ana Prueba', codigo_nuec: 'NUEC-123' };
  const post = (body: object, role = 'coord') => http().post('/ecas').auth(tokens[role], { type: 'bearer' }).send(body);
  const put = (id: number, body: object, role = 'coord') => http().put(`/ecas/${id}`).auth(tokens[role], { type: 'bearer' }).send(body);
  const get = (id: number, adjunto: number, role = 'coord') => http().get(`/ecas/${id}/adjuntos/${adjunto}`).auth(tokens[role], { type: 'bearer' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = module.get(PrismaService);
    const hash = await module.get<PasswordHasher>(PASSWORD_HASHER).hash('Prueba123*');
    for (const [key, perfil] of [['admin', RoleName.ADMINISTRADOR], ['coord', RoleName.COORDINADOR], ['oper', RoleName.OPERARIO]] as const) {
      const rol = await prisma.rol.findUniqueOrThrow({ where: { perfil } });
      const user = await prisma.usuario.create({ data: { usuario: `${key}-eca-${suffix}`, clave: hash, nomUser: 'Prueba', apeUser: suffix, id_perfil: rol.id_perfil } });
      userIds.push(user.id_user);
      const login = await http().post('/auth/login').send({ usuario: user.usuario, clave: 'Prueba123*' }).expect(200);
      tokens[key] = login.body.access_token;
    }
  });

  afterAll(async () => {
    if (prisma) {
      // Incluye creaciones inesperadas de esta prueba sin tocar registros ajenos.
      await prisma.eca.deleteMany({ where: { OR: [{ id_eca: { in: ecaIds } }, { nomEca: nombre }] } });
      if (userIds.length) {
        await prisma.refreshToken.deleteMany({ where: { id_user: { in: userIds } } });
        await prisma.usuario.deleteMany({ where: { id_user: { in: userIds } } });
      }
    }
    if (app) await app.close();
  });

  it('guarda cinco PDF de 2 MB, lista solo metadatos y descarga los bytes originales', async () => {
    const bytes = pdf(2 * 1024 * 1024);
    const adjuntos = Array.from({ length: 5 }, (_, i) => ({ nombre: `Documento ${i}.pdf`, contenido: bytes.toString('base64') }));
    const created = await post({ ...base, adjuntos }).expect(201);
    ecaIds.push(created.body.id_eca);
    expect(created.body).toMatchObject({ ...base, ruta: null, macroruta: null });
    expect(created.body.adjuntos).toHaveLength(5);
    expect(created.body.adjuntos[0]).toEqual({ id: expect.any(Number), nombre: 'Documento 0.pdf', tamano: bytes.length });
    const lista = await http().get('/ecas').auth(tokens.coord, { type: 'bearer' }).expect(200);
    expect(lista.body.find((e: { id_eca: number }) => e.id_eca === created.body.id_eca).adjuntos).toEqual(created.body.adjuntos);
    const download = await get(created.body.id_eca, created.body.adjuntos[0].id).expect(200).expect('Content-Type', /application\/pdf/);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(Buffer.from(download.body)).toEqual(bytes);
  });

  it('conserva datos históricos, conserva adjuntos omitidos y reemplaza la lista al guardar', async () => {
    const created = await post({ ...base, ruta: 'R1', macroruta: 'M1', comuna: 'C1', categoria: 'A', adjuntos: [{ nombre: 'Uno.pdf', contenido: pdf(32).toString('base64') }] }).expect(201);
    const id = created.body.id_eca;
    ecaIds.push(id);
    const oldId = created.body.adjuntos[0].id;
    const edited = await put(id, { representante: 'Luis', codigo_nuec: '' }).expect(200);
    expect(edited.body).toMatchObject({ ruta: 'R1', macroruta: 'M1', comuna: 'C1', categoria: 'A', representante: 'Luis', adjuntos: created.body.adjuntos });
    const replaced = await put(id, { adjuntos: [{ id: oldId }, { nombre: 'Dos.pdf', contenido: pdf(64).toString('base64') }] }).expect(200);
    expect(replaced.body.adjuntos).toHaveLength(2);
    await put(id, { adjuntos: [{ id: replaced.body.adjuntos[1].id }] }).expect(200);
    await get(id, oldId).expect(404);
    expect(await prisma.ecaAdjunto.count({ where: { id_eca: id } })).toBe(1);
    await put(id, { adjuntos: [] }).expect(200);
    expect(await prisma.ecaAdjunto.count({ where: { id_eca: id } })).toBe(0);
  });

  it('rechaza contenido inválido, exceso y referencias ajenas sin guardar parcialmente', async () => {
    const valid = { nombre: 'Valido.pdf', contenido: pdf(32).toString('base64') };
    const created = await post({ ...base, adjuntos: [valid] }).expect(201);
    const id = created.body.id_eca;
    ecaIds.push(id);
    for (const adjuntos of [
      [{ ...valid, contenido: pdf(2 * 1024 * 1024 + 1).toString('base64') }],
      Array.from({ length: 6 }, () => valid),
      [{ nombre: 'Texto.pdf', contenido: Buffer.from('no PDF').toString('base64') }],
      [{ ...valid, nombre: '../fuera.pdf' }],
      [{ id: created.body.adjuntos[0].id + 100000 }],
      [{ id: created.body.adjuntos[0].id }, { id: created.body.adjuntos[0].id }],
    ]) await put(id, { representante: 'No debe guardarse', adjuntos }).expect(400);
    const persisted = await prisma.eca.findUniqueOrThrow({ where: { id_eca: id }, include: { adjuntos: true } });
    expect(persisted.representante).toBe(base.representante);
    expect(persisted.adjuntos).toHaveLength(1);
    const otra = await post(base).expect(201);
    ecaIds.push(otra.body.id_eca);
    await put(otra.body.id_eca, { adjuntos: [{ id: created.body.adjuntos[0].id }] }).expect(400);
    await get(otra.body.id_eca, created.body.adjuntos[0].id).expect(404);
  });

  it('respeta roles y elimina los PDF en cascada al eliminar una ECA propia sin relaciones', async () => {
    const created = await post({ ...base, adjuntos: [{ nombre: 'Prueba.pdf', contenido: pdf(32).toString('base64') }] }).expect(201);
    const id = created.body.id_eca;
    ecaIds.push(id);
    await http().get(`/ecas/${id}/adjuntos/${created.body.adjuntos[0].id}`).expect(401);
    await get(id, created.body.adjuntos[0].id, 'oper').expect(403);
    await get(id, created.body.adjuntos[0].id, 'admin').expect(200);
    await post(base, 'oper').expect(403);
    await put(id, { representante: 'Operario' }, 'oper').expect(403);
    await http().delete(`/ecas/${id}`).auth(tokens.coord, { type: 'bearer' }).expect(403);
    await http().delete(`/ecas/${id}`).auth(tokens.admin, { type: 'bearer' }).expect(204);
    expect(await prisma.ecaAdjunto.count({ where: { id_eca: id } })).toBe(0);
  });
});
