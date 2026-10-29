const { createHash, randomUUID } = require('node:crypto')
const { parseArgs } = require('node:util')
const { PrismaClient } = require('@prisma/client')
const { S3ObjectStorage } = require('../dist/infrastructure/storage/s3-object-storage')
const { validarPdf } = require('../dist/application/ecas/adjuntos-eca')
const { mimeDocumento } = require('../dist/application/recuperadores/documentos-recuperador')

const sources = {
  eca: { model: 'ecaAdjunto', id: 'id', parent: 'id_eca', select: { id: true, id_eca: true, nombre: true, tamano: true, contenido: true }, where: { contenido: { not: null } } },
  documento: { model: 'recuperadorDocumento', id: 'id', parent: 'id_recuperador', select: { id: true, id_recuperador: true, tipo: true, nombre: true, mime: true, tamano: true, contenido: true }, where: { contenido: { not: null } } },
  foto: { model: 'recuperador', id: 'id_recuperador', parent: 'id_recuperador', select: { id_recuperador: true, foto: true }, where: { foto: { not: null }, NOT: { foto: { startsWith: 's3:' } } } },
}
const hash = (bytes, encoding = 'hex') => createHash('sha256').update(bytes).digest(encoding)
const keyOf = (snapshot) => ({ origen: snapshot.origen, origenId: snapshot.id, huella: snapshot.huella })
const whereOf = (snapshot) => ({ origen_origenId_huella: keyOf(snapshot) })
const migrationError = (code) => Object.assign(new Error(code), { migrationCode: code })

function snapshot(origen, row) {
  const source = sources[origen]
  let bytes, nombre, mime, uso
  if (origen === 'foto') {
    const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(row.foto ?? '')
    if (!match) throw migrationError('CONTENIDO_INVALIDO')
    mime = match[1]
    nombre = mime === 'image/png' ? 'foto.png' : 'foto.jpg'
    bytes = Buffer.from(match[2], 'base64')
    if (bytes.toString('base64') !== match[2]) throw migrationError('CONTENIDO_INVALIDO')
    uso = 'foto'
  } else {
    bytes = Buffer.from(row.contenido ?? [])
    nombre = row.nombre
    mime = origen === 'eca' ? 'application/pdf' : row.mime
    uso = origen === 'eca' ? 'eca' : row.tipo
    if (row.tamano !== bytes.length) throw migrationError('TAMANO_INVALIDO')
  }
  const max = origen === 'eca' ? 2097152 : origen === 'foto' ? 1125000 : 1048576
  if (bytes.length < 8 || bytes.length > max) throw migrationError('TAMANO_INVALIDO')
  if (!['eca', 'foto', 'identificacion', 'salud', 'servicios'].includes(uso) ||
      typeof nombre !== 'string' || !/^[^\\/\x00-\x1f\x7f]{1,150}$/.test(nombre)) throw migrationError('CONTENIDO_INVALIDO')
  if (origen === 'eca') validarPdf({ nombre, contenido: bytes.toString('base64') })
  else if (mimeDocumento(nombre, bytes) !== mime) throw migrationError('CONTENIDO_INVALIDO')
  const sha256 = hash(bytes, 'base64')
  const parentId = row[source.parent]
  const huella = hash(JSON.stringify([origen, row[source.id], parentId, nombre, mime, uso, bytes.length, sha256, origen === 'foto' ? row.foto : null]))
  return { origen, id: row[source.id], parentId, nombre, mime, uso, bytes, sha256, huella }
}

async function* candidates(prisma) {
  for (const [origen, source] of Object.entries(sources)) {
    let after = 0
    while (true) {
      const rows = await prisma[source.model].findMany({
        where: { ...source.where, [source.id]: { gt: after } }, select: source.select,
        orderBy: { [source.id]: 'asc' }, take: 25,
      })
      if (!rows.length) break
      for (const row of rows) {
        after = row[source.id]
        yield { origen, row }
      }
    }
  }
}

async function hasSchema(prisma) {
  const [result] = await prisma.$queryRaw`SELECT to_regclass('public.archivos_migraciones') IS NOT NULL AS disponible`
  return result.disponible
}

async function completed(prisma, item) {
  const record = await prisma.archivoMigracion.findUnique({ where: whereOf(item), include: { archivo: true } })
  return record?.estado === 'COMPLETADO' && record.archivo.estado === 'VINCULADO'
}

async function diagnose(prisma) {
  const schema = await hasSchema(prisma)
  const result = { esquemaListo: schema, total: 0, migrados: 0, pendientes: 0, invalidos: 0, bytes: 0 }
  for await (const { origen, row } of candidates(prisma)) {
    result.total++
    let item
    try { item = snapshot(origen, row) } catch (error) {
      if (!error.migrationCode && error.name !== 'ValidationError') throw error
      result.invalidos++
      continue
    }
    result.bytes += item.bytes.length
    if (schema && await completed(prisma, item)) result.migrados++
    else result.pendientes++
  }
  return result
}

async function reserve(prisma, item) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS bloqueado FROM pg_advisory_xact_lock(hashtext(${item.origen}), ${item.id}::integer)`
    const previous = await tx.archivoMigracion.findUnique({ where: whereOf(item), include: { archivo: true } })
    if (previous) return previous
    const id = randomUUID()
    return tx.archivoMigracion.create({
      data: {
        ...keyOf(item),
        archivo: { create: {
          id, uso: item.uso, nombre: item.nombre, mime: item.mime, tamano: item.bytes.length, sha256: item.sha256,
          clave: `archivos/${id}`, claveTemporal: `pendientes/${id}`, estado: 'MIGRANDO',
          expiraEn: new Date(), propietarioId: null,
        } },
      },
      include: { archivo: true },
    })
  })
}

async function bind(prisma, item, record) {
  return prisma.$transaction(async (tx) => {
    if (item.origen === 'eca') await tx.$queryRaw`SELECT id_eca FROM ecas WHERE id_eca = ${item.parentId} FOR UPDATE`
    else await tx.$queryRaw`SELECT id_recuperador FROM recuperadores WHERE id_recuperador = ${item.parentId} FOR UPDATE`
    if (item.origen === 'eca') await tx.$queryRaw`SELECT id FROM eca_adjuntos WHERE id = ${item.id} FOR UPDATE`
    if (item.origen === 'documento') await tx.$queryRaw`SELECT id FROM recuperador_documentos WHERE id = ${item.id} FOR UPDATE`
    await tx.$queryRaw`SELECT 1 AS bloqueado FROM pg_advisory_xact_lock(hashtext(${item.origen}), ${item.id}::integer)`
    const source = sources[item.origen]
    const row = await tx[source.model].findUnique({ where: { [source.id]: item.id }, select: source.select })
    let unchanged = false
    if (row) {
      try { unchanged = snapshot(item.origen, row).huella === item.huella } catch (error) {
        if (!error.migrationCode && error.name !== 'ValidationError') throw error
      }
    }
    if (!unchanged) {
      const current = await tx.archivoCarga.findUniqueOrThrow({ where: { id: record.archivoId } })
      if (current.estado !== 'VINCULADO') {
        await tx.archivoCarga.update({ where: { id: record.archivoId }, data: { estado: 'RETIRADO' } })
        await tx.archivoMigracion.update({ where: whereOf(item), data: { estado: 'CAMBIADO', codigoError: 'ORIGEN_CAMBIADO' } })
      }
      return 'cambiados'
    }
    if (await completed(tx, item)) return 'omitidos'
    await tx.archivoCarga.updateMany({
      where: { uso: item.uso, vinculoId: item.id, estado: 'VINCULADO', id: { not: record.archivoId } },
      data: { estado: 'RETIRADO' },
    })
    await tx.archivoCarga.update({ where: { id: record.archivoId }, data: { estado: 'VINCULADO', vinculoId: item.id } })
    await tx.archivoMigracion.update({ where: whereOf(item), data: { estado: 'COMPLETADO', codigoError: null } })
    return 'migrados'
  })
}

function errorCode(error) {
  if (error.migrationCode) return error.migrationCode
  if (error.name === 'ValidationError') return 'CONTENIDO_INVALIDO'
  if (error.name === 'ConflictError') return 'OBJETO_NO_COINCIDE'
  if (error.name === 'PrismaClientValidationError') return 'CONTRATO_BASE_DATOS'
  if (typeof error.code === 'string' && /^P\d{4}$/.test(error.code)) return 'BASE_DATOS'
  if (error.name === 'PrismaClientUnknownRequestError') return 'CONSULTA_BASE_DATOS'
  return 'ALMACENAMIENTO_O_CONEXION'
}

async function migrate({ prisma, storage, limit = 100 }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw migrationError('LIMITE_INVALIDO')
  if (!storage.enabled || !await hasSchema(prisma)) throw migrationError('CONFIGURACION_INCOMPLETA')
  const result = { migrados: 0, omitidos: 0, cambiados: 0, fallidos: 0, errores: {} }
  let attempted = 0
  for await (const { origen, row } of candidates(prisma)) {
    if (attempted >= limit) break
    let item, record
    try {
      item = snapshot(origen, row)
      if (await completed(prisma, item)) { result.omitidos++; continue }
      attempted++
      record = await reserve(prisma, item)
      await storage.writeOnce(record.archivo.clave, item.bytes, item.mime, item.sha256)
      const downloaded = await storage.read(record.archivo.clave, item.bytes.length)
      if (downloaded.length !== item.bytes.length || hash(downloaded, 'base64') !== item.sha256) throw migrationError('VERIFICACION_S3')
      result[await bind(prisma, item, record)]++
    } catch (error) {
      const code = errorCode(error)
      result.fallidos++
      result.errores[code] = (result.errores[code] ?? 0) + 1
      if (!item) attempted++
      if (record) {
        await prisma.archivoMigracion.updateMany({
          where: { ...keyOf(item), estado: { not: 'COMPLETADO' } },
          data: { estado: 'FALLIDO', codigoError: code },
        })
      }
    }
  }
  return { ...result, diagnostico: await diagnose(prisma) }
}

async function main() {
  const { values } = parseArgs({ options: {
    diagnostico: { type: 'boolean' }, ejecutar: { type: 'boolean' },
    'confirmar-copia': { type: 'boolean' }, limite: { type: 'string', default: '100' },
  } })
  if (Boolean(values.diagnostico) === Boolean(values.ejecutar) || (values.ejecutar && !values['confirmar-copia'])) {
    throw migrationError('USA_DIAGNOSTICO_O_EJECUTAR_CON_CONFIRMAR_COPIA')
  }
  const url = process.env.MIGRATION_DATABASE_URL
  if (!url || !['postgresql:', 'postgres:'].includes(new URL(url).protocol)) throw migrationError('MIGRATION_DATABASE_URL_REQUERIDA')
  if (values.ejecutar && (process.env.FILE_STORAGE !== 's3' || !process.env.S3_FILES_BUCKET ||
    (process.env.S3_ENDPOINT && process.env.NODE_ENV !== 'test'))) throw migrationError('CONFIGURACION_S3_INVALIDA')
  const prisma = new PrismaClient({ datasourceUrl: url, log: [] })
  try {
    const result = values.diagnostico ? await diagnose(prisma) :
      await migrate({ prisma, storage: new S3ObjectStorage(), limit: Number(values.limite) })
    console.log(JSON.stringify({ modo: values.diagnostico ? 'diagnostico' : 'copia', ...result }))
    if (result.fallidos || result.cambiados || result.invalidos) process.exitCode = 1
  } finally { await prisma.$disconnect() }
}

module.exports = { diagnose, migrate }
if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ error: error.migrationCode ?? 'OPERACION_FALLIDA', detalle: 'No se muestran datos del origen ni credenciales. Revisar configuracion, permisos y conectividad.' }))
  process.exitCode = 1
})
