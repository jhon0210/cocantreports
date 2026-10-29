import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * E2E contra la base de datos real (reportesbd) usando los datos del seeder.
 * Todo lo que crea se elimina en afterAll. Requiere haber ejecutado migraciones y seeders.
 */
describe('API (e2e)', () => {
  const E2E_CEDULA = '7770000099';
  let app: INestApplication;
  const prisma = new PrismaClient();
  const http = () => request(app.getHttpServer());

  const tokens: Record<string, string> = {};
  const cookies: Record<string, string[]> = {};
  const createdReportes: number[] = [];
  const createdUsuarios: string[] = [];
  const createdEcas: number[] = [];
  const createdRecuperadores: string[] = [];
  let recuperadorId: number;
  let ecaId: number;
  let materialId: number;
  let operarioId: number;

  async function login(usuario: string, clave: string) {
    return http().post('/auth/login').send({ usuario, clave });
  }
  const auth = (rol: string) => ({ Authorization: `Bearer ${tokens[rol]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    for (const [rol, usuario, clave] of [
      ['admin', 'admin1', 'Admin123*'],
      ['coord', 'coordinador1', 'Coord123*'],
      ['oper', 'operario1', 'Operario123*'],
    ]) {
      const res = await login(usuario, clave);
      expect(res.status).toBe(200);
      tokens[rol] = res.body.access_token;
      cookies[rol] = res.headers['set-cookie'] as unknown as string[];
    }
    operarioId = (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'operario1' } })).id_user;
    // Recuperador propio de la suite: no depende de los datos del seeder (que un usuario puede borrar).
    const rec = await prisma.recuperador.upsert({
      where: { cedula: E2E_CEDULA },
      update: { id_estado: 1 },
      create: { nombre: 'Base', apellido: 'E2E', cedula: E2E_CEDULA, bancarizado: true },
    });
    createdRecuperadores.push(E2E_CEDULA);
    recuperadorId = rec.id_recuperador;
    ecaId = (await prisma.eca.findFirstOrThrow({ orderBy: { id_eca: 'asc' } })).id_eca;
    materialId = (await prisma.material.findFirstOrThrow({ where: { codigo: 101 } })).id_mat;
  });

  afterAll(async () => {
    if (createdReportes.length) await prisma.reporte.deleteMany({ where: { consecutivo: { in: createdReportes } } });
    if (createdRecuperadores.length) await prisma.recuperador.deleteMany({ where: { cedula: { in: createdRecuperadores } } });
    if (createdEcas.length) await prisma.eca.deleteMany({ where: { id_eca: { in: createdEcas } } });
    if (createdUsuarios.length) await prisma.usuario.deleteMany({ where: { usuario: { in: createdUsuarios } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('autenticación', () => {
    it('login entrega access token, cookie HttpOnly y no expone la clave', async () => {
      const res = await login('operario1', 'Operario123*');
      expect(res.status).toBe(200);
      expect(res.body.token_type).toBe('Bearer');
      expect(res.body.user).toMatchObject({ usuario: 'operario1', perfil: 'Operario' });
      expect(JSON.stringify(res.body)).not.toMatch(/clave|hash|\$2b\$/);
      expect(res.body).not.toHaveProperty('refresh_token');
      const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(cookie).toMatch(/refresh_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    it('rechaza clave incorrecta y usuario inexistente con el mismo mensaje', async () => {
      const a = await login('operario1', 'Incorrecta1*');
      const b = await login('no.existe', 'Incorrecta1*');
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body.message).toBe(b.body.message);
    });

    it('la clave se guarda hasheada con bcrypt', async () => {
      const u = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'operario1' } });
      expect(u.clave).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(u.clave).not.toContain('Operario123');
    });

    it('rutas protegidas exigen token', async () => {
      for (const path of ['/auth/profile', '/materiales', '/reportes', '/recuperadores/cedula/' + E2E_CEDULA]) {
        expect((await http().get(path)).status).toBe(401);
      }
      expect((await http().get('/materiales').set('Authorization', 'Bearer basura')).status).toBe(401);
    });

    it('un refresh token no sirve como access token', async () => {
      const refresh = /refresh_token=([^;]+)/.exec(cookies.oper.join(';'))![1];
      const res = await http().get('/auth/profile').set('Authorization', `Bearer ${refresh}`);
      expect(res.status).toBe(401);
    });

    it('GET /auth/profile devuelve el usuario sin clave', async () => {
      const res = await http().get('/auth/profile').set(auth('oper'));
      expect(res.status).toBe(200);
      expect(res.body.usuario).toBe('operario1');
      expect(res.body).not.toHaveProperty('clave');
    });

    it('refresh rota el token; el anterior ya no sirve; logout lo revoca', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent.post('/auth/login').send({ usuario: 'operario1', clave: 'Operario123*' }).expect(200);
      const initialCookie = (loginRes.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      const firstCookie = (await agent.post('/auth/refresh').expect(200)).headers['set-cookie'] as unknown as string[];
      expect(firstCookie.join(';')).toMatch(/refresh_token=/);

      // El token inicial fue rotado: usarlo de nuevo debe fallar
      const stale = await http().post('/auth/refresh').set('Cookie', initialCookie);
      expect(stale.status).toBe(401);

      // El agente (con el token rotado vigente) sigue funcionando y luego cierra sesión
      await agent.post('/auth/refresh').expect(200);
      await agent.post('/auth/logout').expect(204);
      await agent.post('/auth/refresh').expect(401);
    });

    it('refresh sin cookie, o con un JWT arbitrario, se rechaza', async () => {
      expect((await http().post('/auth/refresh')).status).toBe(401);
      const forged = await http().post('/auth/refresh').set('Cookie', `refresh_token=${tokens.oper}`);
      expect(forged.status).toBe(401);
    });

    it('reutilizar un token ya rotado (fuera de la ventana de gracia) revoca toda la familia', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent.post('/auth/login').send({ usuario: 'coordinador1', clave: 'Coord123*' }).expect(200);
      const stolen = (loginRes.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      await agent.post('/auth/refresh').expect(200); // rota: `stolen` queda revocado, el agente tiene el nuevo

      // Se envejece la revocación para simular que pasó la ventana de gracia
      await prisma.refreshToken.updateMany({ where: { revoked_at: { not: null }, usuario: { usuario: 'coordinador1' } }, data: { revoked_at: new Date(Date.now() - 60_000) } });

      expect((await http().post('/auth/refresh').set('Cookie', stolen)).status).toBe(401);
      // La familia completa quedó revocada: el token legítimo tampoco sirve
      expect((await agent.post('/auth/refresh')).status).toBe(401);
    });
  });

  describe('permisos por rol', () => {
    it('Operario ve las ECAs (para elegir la bodega) pero no las crea; tampoco accede a recuperadores ni usuarios', async () => {
      expect((await http().get('/ecas').set(auth('oper'))).status).toBe(200);
      expect((await http().post('/ecas').set(auth('oper')).send({})).status).toBe(403);
      expect((await http().get('/recuperadores').set(auth('oper'))).status).toBe(403);
      expect((await http().get('/usuarios').set(auth('oper'))).status).toBe(403);
      expect((await http().get('/catalogos/roles').set(auth('oper'))).status).toBe(403);
    });

    it('Coordinador consulta todo y gestiona usuarios, pero no crea reportes ni ECAs', async () => {
      expect((await http().get('/usuarios').set(auth('coord'))).status).toBe(200);
      expect((await http().get('/ecas').set(auth('coord'))).status).toBe(200);
      expect((await http().get('/recuperadores').set(auth('coord'))).status).toBe(200);
      expect((await http().get('/reportes').set(auth('coord'))).status).toBe(200);
      expect((await http().post('/reportes').set(auth('coord')).send({})).status).toBe(403);
      expect((await http().post('/ecas').set(auth('coord')).send({})).status).toBe(403);
    });

    it('Coordinador no puede crear Administradores; no ve ese perfil en el catálogo', async () => {
      const roles = await http().get('/catalogos/roles').set(auth('coord'));
      expect(roles.body.map((r: { perfil: string }) => r.perfil)).not.toContain('Administrador');

      const adminRole = await prisma.rol.findFirstOrThrow({ where: { perfil: 'Administrador' } });
      const res = await http().post('/usuarios').set(auth('coord')).send({
        nomUser: 'X', apeUser: 'Y', usuario: 'e2e.escalada', clave: 'Clave1234', cedula: 99990001, id_perfil: adminRole.id_perfil,
      });
      expect(res.status).toBe(403);
      expect(await prisma.usuario.findUnique({ where: { usuario: 'e2e.escalada' } })).toBeNull();
    });
  });

  describe('materiales y recuperadores', () => {
    it('lista materiales y detalle', async () => {
      const list = await http().get('/materiales').set(auth('oper'));
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(5);
      expect(list.body[0]).toEqual(expect.objectContaining({ id_mat: expect.any(Number), codigo: expect.any(Number), nomMaterial: expect.any(String) }));
      expect((await http().get(`/materiales/${materialId}`).set(auth('oper'))).status).toBe(200);
      expect((await http().get('/materiales/999999').set(auth('oper'))).status).toBe(404);
      expect((await http().get('/materiales/abc').set(auth('oper'))).status).toBe(400);
    });

    it('busca recuperador por cédula (sin ECA, con su estado); 404 si no existe; 400 si es inválida', async () => {
      const ok = await http().get(`/recuperadores/cedula/${E2E_CEDULA}`).set(auth('oper'));
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ cedula: E2E_CEDULA, estado: 'Activo' });
      expect(ok.body).not.toHaveProperty('id_eca');
      expect(ok.body).not.toHaveProperty('eca');
      expect((await http().get('/recuperadores/cedula/5555555555').set(auth('oper'))).status).toBe(404);
      expect((await http().get('/recuperadores/cedula/abc').set(auth('oper'))).status).toBe(400);
    });

    it('/usuarios/cedula/:cedula delega en el caso de uso de recuperadores', async () => {
      const res = await http().get(`/usuarios/cedula/${E2E_CEDULA}`).set(auth('oper'));
      expect(res.status).toBe(200);
      expect(res.body.cedula).toBe(E2E_CEDULA);
    });

    it('Administrador crea ECA, la actualiza; valida campos requeridos', async () => {
      const bad = await http().post('/ecas').set(auth('admin')).send({ nomEca: 'Solo nombre' });
      expect(bad.status).toBe(400);

      const created = await http().post('/ecas').set(auth('admin')).send({
        nomEca: '  ECA E2E   Temporal ', direccion: 'Calle 1 # 2-3', ruta: 'R-99', macroruta: 'Macro E2E',
      });
      expect(created.status).toBe(201);
      createdEcas.push(created.body.id_eca);
      expect(created.body).toMatchObject({ nomEca: 'ECA E2E Temporal', ruta: 'R-99', macroruta: 'Macro E2E', estado: 'Activa' });

      const updated = await http().put(`/ecas/${created.body.id_eca}`).set(auth('admin')).send({ comuna: 'Comuna 99' });
      expect(updated.status).toBe(200);
      expect(updated.body.comuna).toBe('Comuna 99');
      expect((await http().put('/ecas/999999').set(auth('admin')).send({ comuna: 'x' })).status).toBe(404);
    });

    it('Administrador crea recuperador con foto; duplicado -> 409; foto inválida -> 400; ya no acepta id_eca', async () => {
      const foto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
      const created = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Prueba', apellido: 'E2E', cedula: '7770000001', bancarizado: true, foto,
      });
      expect(created.status).toBe(201);
      createdRecuperadores.push('7770000001');
      expect(created.body).toMatchObject({ cedula: '7770000001', bancarizado: true, tiene_foto: true });

      const dup = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Otra', apellido: 'Persona', cedula: '7770000001', bancarizado: false,
      });
      expect(dup.status).toBe(409);

      const badFoto = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Foto', apellido: 'Mala', cedula: '7770000002', bancarizado: false, foto: 'javascript:alert(1)',
      });
      expect(badFoto.status).toBe(400);

      const list = await http().get('/recuperadores').set(auth('admin'));
      const row = list.body.find((r: { cedula: string }) => r.cedula === '7770000001');
      expect(row).toMatchObject({ tiene_foto: true, foto: null });

      const conEca = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Con', apellido: 'Eca', cedula: '7770000003', id_eca: ecaId, bancarizado: false,
      });
      expect(conEca.status).toBe(400);
    });

    it('catálogo de estados: Activo, Inactivo y Fallecido; el Operario no accede', async () => {
      const res = await http().get('/recuperadores/estados').set(auth('coord'));
      expect(res.status).toBe(200);
      expect(res.body.map((e: { nombre: string }) => e.nombre)).toEqual(['Activo', 'Inactivo', 'Fallecido']);
      expect((await http().get('/recuperadores/estados').set(auth('oper'))).status).toBe(403);
    });

    it('CRUD de recuperador: nace Activo, se consulta, edita (conservando la foto), cambia de estado y se elimina', async () => {
      const foto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
      const created = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Crud', apellido: 'Prueba', cedula: '7770000010', bancarizado: false, foto,
      });
      expect(created.status).toBe(201);
      const id = created.body.id_recuperador;
      createdRecuperadores.push('7770000010');
      expect(created.body).toMatchObject({ id_estado: 1, estado: 'Activo' });

      // Detalle (con foto), solo Admin/Coordinador
      const detail = await http().get(`/recuperadores/${id}`).set(auth('coord'));
      expect(detail.status).toBe(200);
      expect(detail.body.foto).toBe(foto);
      expect((await http().get(`/recuperadores/${id}`).set(auth('oper'))).status).toBe(403);
      expect((await http().get('/recuperadores/999999').set(auth('admin'))).status).toBe(404);

      // Actualización parcial: sin foto en el cuerpo, la foto se conserva
      const upd = await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ nombre: 'Editado', bancarizado: true, id_estado: 2 });
      expect(upd.status).toBe(200);
      expect(upd.body).toMatchObject({ nombre: 'Editado', bancarizado: true, estado: 'Inactivo', tiene_foto: true, foto });

      // Validaciones de la actualización
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ id_estado: 99 })).status).toBe(404);
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ id_eca: ecaId })).status).toBe(400);
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ cedula: E2E_CEDULA })).status).toBe(409);
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ cedula: 'abc' })).status).toBe(400);
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ foto: 'javascript:alert(1)' })).status).toBe(400);
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ desconocido: 1 })).status).toBe(400);
      // Reenviar la misma cédula no es un conflicto consigo mismo
      expect((await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ cedula: '7770000010' })).status).toBe(200);

      // Permisos de escritura: solo Administrador
      expect((await http().patch(`/recuperadores/${id}`).set(auth('coord')).send({ nombre: 'X' })).status).toBe(403);
      expect((await http().delete(`/recuperadores/${id}`).set(auth('coord'))).status).toBe(403);

      // Eliminación
      expect((await http().delete(`/recuperadores/${id}`).set(auth('admin'))).status).toBe(204);
      expect((await http().get(`/recuperadores/${id}`).set(auth('admin'))).status).toBe(404);
      expect((await http().delete(`/recuperadores/${id}`).set(auth('admin'))).status).toBe(404);
    });

    it('un recuperador con ventas no se elimina (409) y uno Inactivo/Fallecido no puede registrar ventas (422)', async () => {
      const created = await http().post('/recuperadores').set(auth('admin')).send({
        nombre: 'Con', apellido: 'Ventas', cedula: '7770000020', bancarizado: true,
      });
      expect(created.status).toBe(201);
      const id = created.body.id_recuperador;
      createdRecuperadores.push('7770000020');

      const venta = { id_recuperador: id, id_mat: materialId, id_eca: ecaId, cantidad: 3, valor: 500 };
      const ok = await http().post('/reportes').set(auth('oper')).send(venta);
      expect(ok.status).toBe(201);
      createdReportes.push(ok.body.consecutivo);

      expect((await http().delete(`/recuperadores/${id}`).set(auth('admin'))).status).toBe(409);

      for (const [estado, nombre] of [[2, 'Inactivo'], [3, 'Fallecido']] as const) {
        await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ id_estado: estado }).expect(200);
        const bloqueado = await http().post('/reportes').set(auth('oper')).send(venta);
        expect(bloqueado.status).toBe(422);
        expect(bloqueado.body.message).toContain(nombre);
        // Sigue siendo consultable por cédula (el carnet muestra su estado)
        const byCedula = await http().get('/recuperadores/cedula/7770000020').set(auth('oper'));
        expect(byCedula.body.estado).toBe(nombre);
      }

      await http().patch(`/recuperadores/${id}`).set(auth('admin')).send({ id_estado: 1 }).expect(200);
      const again = await http().post('/reportes').set(auth('oper')).send(venta);
      expect(again.status).toBe(201);
      createdReportes.push(again.body.consecutivo);
    });
  });

  describe('reportes', () => {
    const valido = () => ({ id_recuperador: recuperadorId, id_mat: materialId, id_eca: ecaId, cantidad: 12.5, valor: 800 });

    it('crea el reporte con id_user del token, la ECA elegida y FechaRegistro del servidor', async () => {
      const res = await http().post('/reportes').set(auth('oper')).send(valido());
      expect(res.status).toBe(201);
      createdReportes.push(res.body.consecutivo);
      expect(res.body).toMatchObject({
        id_user: operarioId,
        id_eca: ecaId,
        id_recuperador: recuperadorId,
        id_mat: materialId,
        cantidad: 12.5,
        valor: 800,
        subtotal: 10000,
        recuperador: { cedula: E2E_CEDULA },
      });
      expect(res.body.FechaRegistro).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.FechaVenta).toBe(res.body.FechaRegistro);

      const row = await prisma.reporte.findUniqueOrThrow({ where: { consecutivo: res.body.consecutivo } });
      expect(row.id_user).toBe(operarioId);
      expect(row.id_eca).toBe(ecaId);
    });

    it('no permite forzar id_user ni FechaRegistro ni valores inválidos', async () => {
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), id_user: 1 })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), FechaRegistro: '2020-01-01' })).status).toBe(400);
      const cero = await http().post('/reportes').set(auth('oper')).send({ ...valido(), cantidad: 0 });
      expect(cero.status).toBe(201);
      createdReportes.push(cero.body.consecutivo);
      expect(cero.body).toMatchObject({ cantidad: 0, subtotal: 0 });
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), cantidad: -3 })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), valor: 0 })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), valor: 10.5 })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), FechaVenta: '2999-01-01' })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), FechaVenta: '2026-02-31' })).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), id_mat: 999999 })).status).toBe(404);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), id_recuperador: 999999 })).status).toBe(404);
    });

    it('la ECA es obligatoria y debe existir (400 / 404); acepta una fecha de venta pasada', async () => {
      const { id_eca: _omit, ...sinEca } = valido();
      expect((await http().post('/reportes').set(auth('oper')).send(sinEca)).status).toBe(400);
      expect((await http().post('/reportes').set(auth('oper')).send({ ...valido(), id_eca: 999999 })).status).toBe(404);

      const ok = await http().post('/reportes').set(auth('oper')).send({ ...valido(), FechaVenta: '2026-01-15' });
      expect(ok.status).toBe(201);
      createdReportes.push(ok.body.consecutivo);
      expect(ok.body.FechaVenta).toBe('2026-01-15');
    });

    it('Operario solo ve sus reportes; Administrador y Coordinador ven todos; detalle ajeno -> 404', async () => {
      // Reporte creado por el administrador
      const adminReport = await http().post('/reportes').set(auth('admin')).send(valido());
      expect(adminReport.status).toBe(201);
      createdReportes.push(adminReport.body.consecutivo);

      const operList = await http().get('/reportes').set(auth('oper'));
      expect(operList.status).toBe(200);
      expect(operList.body.every((r: { id_user: number }) => r.id_user === operarioId)).toBe(true);
      expect(operList.body.some((r: { consecutivo: number }) => r.consecutivo === adminReport.body.consecutivo)).toBe(false);

      const adminList = await http().get('/reportes').set(auth('admin'));
      expect(adminList.body.some((r: { consecutivo: number }) => r.consecutivo === adminReport.body.consecutivo)).toBe(true);
      expect(adminList.body.some((r: { id_user: number }) => r.id_user === operarioId)).toBe(true);

      const coordList = await http().get('/reportes').set(auth('coord'));
      expect(coordList.body.length).toBe(adminList.body.length);

      expect((await http().get(`/reportes/${adminReport.body.consecutivo}`).set(auth('oper'))).status).toBe(404);
      expect((await http().get(`/reportes/${adminReport.body.consecutivo}`).set(auth('admin'))).status).toBe(200);
      expect((await http().get(`/reportes/${createdReportes[0]}`).set(auth('oper'))).status).toBe(200);
      expect((await http().get('/reportes?limit=1').set(auth('admin'))).body).toHaveLength(1);
      expect((await http().get('/reportes?limit=9999').set(auth('admin'))).status).toBe(400);
    });
  });

  describe('usuarios', () => {
    it('crea, actualiza y desactiva un usuario; el desactivado no puede entrar', async () => {
      const created = await http().post('/usuarios').set(auth('coord')).send({
        nomUser: 'Prueba', apeUser: 'E2E', usuario: 'e2e.usuario', clave: 'Clave1234', cedula: 99990002, id_perfil: 3, id_cargo: 1,
      });
      expect(created.status).toBe(201);
      createdUsuarios.push('e2e.usuario');
      expect(created.body).not.toHaveProperty('clave');
      expect(created.body.perfil).toBe('Operario');

      const stored = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'e2e.usuario' } });
      expect(stored.clave).toMatch(/^\$2[aby]\$/);

      expect((await login('e2e.usuario', 'Clave1234')).status).toBe(200);

      const dup = await http().post('/usuarios').set(auth('coord')).send({
        nomUser: 'Otro', apeUser: 'E2E', usuario: 'e2e.usuario', clave: 'Clave1234', cedula: 99990003, id_perfil: 3,
      });
      expect(dup.status).toBe(409);

      const weak = await http().post('/usuarios').set(auth('coord')).send({
        nomUser: 'Debil', apeUser: 'E2E', usuario: 'e2e.debil', clave: 'abc', cedula: 99990004, id_perfil: 3,
      });
      expect(weak.status).toBe(400);

      const upd = await http().patch(`/usuarios/${created.body.id_user}`).set(auth('coord')).send({ nomUser: 'Cambiado' });
      expect(upd.status).toBe(200);
      expect(upd.body.nomUser).toBe('Cambiado');

      expect((await http().delete(`/usuarios/${created.body.id_user}`).set(auth('coord'))).status).toBe(204);
      expect((await login('e2e.usuario', 'Clave1234')).status).toBe(401);
    });

    it('nadie puede desactivarse a sí mismo ni tocar cuentas de Administrador siendo Coordinador', async () => {
      const admin = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'admin1' } });
      expect((await http().delete(`/usuarios/${admin.id_user}`).set(auth('admin'))).status).toBe(422);
      expect((await http().patch(`/usuarios/${admin.id_user}`).set(auth('coord')).send({ nomUser: 'Hack' })).status).toBe(403);
      expect((await http().delete(`/usuarios/${admin.id_user}`).set(auth('coord'))).status).toBe(403);
    });
  });

  it('Swagger está disponible en /api/docs', async () => {
    const swaggerApp = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nest = swaggerApp.createNestApplication();
    configureApp(nest);
    const { setupSwagger } = await import('../src/app.setup');
    setupSwagger(nest);
    await nest.init();
    const res = await request(nest.getHttpServer()).get('/api/docs-json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/auth/login', '/reportes', '/recuperadores/cedula/{cedula}']));
    expect((await request(nest.getHttpServer()).get('/api/docs')).status).toBe(200);
    await nest.close();
  });
});
