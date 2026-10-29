import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Seeder idempotente: se puede ejecutar varias veces sin duplicar datos.
 * Todos los datos son ficticios. Las claves se guardan siempre hasheadas (bcrypt).
 * Las claves de usuarios existentes NO se sobrescriben al re-ejecutar.
 */
const prisma = new PrismaClient();
const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

const ROLES = [
  { id_perfil: 1, perfil: 'Administrador' },
  { id_perfil: 2, perfil: 'Coordinador' },
  { id_perfil: 3, perfil: 'Operario' },
  { id_perfil: 4, perfil: 'Administrador Eca' },
];

const ESTADOS_RECUPERADOR = [
  { id_estado: 1, nombre: 'Activo' },
  { id_estado: 2, nombre: 'Inactivo' },
  { id_estado: 3, nombre: 'Fallecido' },
];

const CARGOS = [
  { cargo: 'Operario de bodega', estado: 'Activo' },
  { cargo: 'Supervisor', estado: 'Activo' },
];

const MATERIALES = [
  { codigo: 101, nomMaterial: 'Cartón' },
  { codigo: 102, nomMaterial: 'PET' },
  { codigo: 103, nomMaterial: 'Vidrio' },
  { codigo: 104, nomMaterial: 'Chatarra' },
  { codigo: 105, nomMaterial: 'Aluminio' },
  { codigo: 106, nomMaterial: 'Papel archivo' },
  { codigo: 107, nomMaterial: 'Plástico duro' },
];

const ECAS = [
  { nomEca: 'ECA Centro Verde', direccion: 'Calle 10 # 5-20', comuna: 'Comuna 10', estado: 'Activa', categoria: 'A', ruta: 'R-01', macroruta: 'Macroruta Centro' },
  { nomEca: 'ECA Norte Limpio', direccion: 'Carrera 45 # 80-15', comuna: 'Comuna 2', estado: 'Activa', categoria: 'B', ruta: 'R-02', macroruta: 'Macroruta Norte' },
  { nomEca: 'ECA Sur Recicla', direccion: 'Calle 30 Sur # 12-40', comuna: 'Comuna 14', estado: 'Activa', categoria: 'A', ruta: 'R-03', macroruta: 'Macroruta Sur' },
  { nomEca: 'ECA Oriente Sostenible', direccion: 'Avenida 8 # 33-10', comuna: 'Comuna 8', estado: 'Activa', categoria: 'C', ruta: 'R-04', macroruta: 'Macroruta Oriente' },
  { nomEca: 'ECA Occidente Eco', direccion: 'Carrera 70 # 25-60', comuna: 'Comuna 12', estado: 'Activa', categoria: 'B', ruta: 'R-05', macroruta: 'Macroruta Occidente' },
];

const USUARIOS = [
  { usuario: 'admin1', clave: 'Admin123*', nomUser: 'Ana', apeUser: 'Administradora', cedula: 1000000001, id_perfil: 1, cargo: 'Supervisor' },
  { usuario: 'coordinador1', clave: 'Coord123*', nomUser: 'Carlos', apeUser: 'Coordinador', cedula: 1000000002, id_perfil: 2, cargo: 'Supervisor' },
  { usuario: 'operario1', clave: 'Operario123*', nomUser: 'Olga', apeUser: 'Operaria', cedula: 1000000003, id_perfil: 3, cargo: 'Operario de bodega' },
];

const RECUPERADORES = [
  { nombre: 'Juan', apellido: 'Pérez Gómez', cedula: '1090000001', bancarizado: true },
  { nombre: 'María', apellido: 'López Rojas', cedula: '1090000002', bancarizado: false },
  { nombre: 'Pedro', apellido: 'Ramírez Díaz', cedula: '1090000003', bancarizado: true },
  { nombre: 'Luisa', apellido: 'Martínez Cruz', cedula: '1090000004', bancarizado: false },
  { nombre: 'Andrés', apellido: 'Torres Vega', cedula: '1090000005', bancarizado: true },
];

async function main() {
  for (const r of ROLES) {
    await prisma.rol.upsert({ where: { id_perfil: r.id_perfil }, update: { perfil: r.perfil }, create: r });
  }

  for (const e of ESTADOS_RECUPERADOR) {
    await prisma.estadoRecuperador.upsert({ where: { id_estado: e.id_estado }, update: { nombre: e.nombre }, create: e });
  }

  for (const c of CARGOS) {
    const existe = await prisma.cargo.findFirst({ where: { cargo: c.cargo } });
    if (!existe) await prisma.cargo.create({ data: c });
  }

  for (const m of MATERIALES) {
    await prisma.material.upsert({ where: { codigo: m.codigo }, update: { nomMaterial: m.nomMaterial }, create: m });
  }

  for (const e of ECAS) {
    const existe = await prisma.eca.findFirst({ where: { nomEca: e.nomEca } });
    if (!existe) await prisma.eca.create({ data: e });
  }

  for (const u of USUARIOS) {
    const cargo = await prisma.cargo.findFirstOrThrow({ where: { cargo: u.cargo } });
    const existe = await prisma.usuario.findUnique({ where: { usuario: u.usuario } });
    if (existe) continue;
    await prisma.usuario.create({
      data: {
        usuario: u.usuario,
        clave: await bcrypt.hash(u.clave, rounds),
        nomUser: u.nomUser,
        apeUser: u.apeUser,
        cedula: u.cedula,
        id_perfil: u.id_perfil,
        id_cargo: cargo.id_cargo,
      },
    });
  }

  for (const r of RECUPERADORES) {
    await prisma.recuperador.upsert({
      where: { cedula: r.cedula },
      update: {},
      create: { nombre: r.nombre, apellido: r.apellido, cedula: r.cedula, bancarizado: r.bancarizado },
    });
  }

  const [roles, materiales, ecas, usuarios, recuperadores] = await Promise.all([
    prisma.rol.count(),
    prisma.material.count(),
    prisma.eca.count(),
    prisma.usuario.count(),
    prisma.recuperador.count(),
  ]);
  console.log(`Seed OK -> roles:${roles} materiales:${materiales} ecas:${ecas} usuarios:${usuarios} recuperadores:${recuperadores}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
