const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3')
const { randomUUID } = require('node:crypto')
const { S3ObjectStorage } = require('./dist/infrastructure/storage/s3-object-storage')
const { diagnose, migrate } = require('./tools/migrate-files.cjs')

const pdf = Buffer.from('%PDF-1.7\nsynthetic migration\n%%EOF')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXp0AAAAASUVORK5CYII=', 'base64')
const photo = `data:image/png;base64,${png.toString('base64')}`
const hash = (bytes) => createHash('sha256').update(bytes).digest('base64')

async function main() {
  const url = new URL(process.env.DATABASE_URL)
  assert.match(url.hostname, /^cocjant-db-[a-f0-9]{12}$/)
  assert.equal(url.pathname, '/cocjant_check')
  assert.equal(url.username, 'cocjant_check')
  const prisma = new PrismaClient()
  const storage = new S3ObjectStorage()
  const s3 = new S3Client({ region: 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true })
  const cli = (args, environment = {}) => {
    const result = spawnSync(process.execPath, ['tools/migrate-files.cjs', ...args], {
      env: { ...process.env, MIGRATION_DATABASE_URL: process.env.DATABASE_URL, ...environment }, encoding: 'utf8',
    })
    if (result.error) throw result.error
    return { status: result.status, output: JSON.parse((result.stdout || result.stderr).trim()) }
  }
  try {
    const eca = await prisma.eca.findFirstOrThrow()
    const recuperador = await prisma.recuperador.create({ data: {
      nombre: 'Migration', apellido: 'Synthetic', cedula: '99999900003', foto: photo,
      documentos: { create: { tipo: 'salud', nombre: 'synthetic.pdf', mime: 'application/pdf', tamano: pdf.length, contenido: pdf } },
    }, include: { documentos: true } })
    const initial = await diagnose(prisma)
    assert.deepEqual(initial, { esquemaListo: true, total: 3, migrados: 0, pendientes: 3, invalidos: 0, bytes: initial.bytes })
    assert.equal(await prisma.archivoCarga.count(), 0)
    assert.equal(await prisma.archivoMigracion.count(), 0)
    assert.equal((await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_FILES_BUCKET }))).KeyCount, 0)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`
      assert.deepEqual(await diagnose(tx), initial)
    })
    const diagnosticCli = cli(['--diagnostico'], { S3_ENDPOINT: 'http://invalid.example.test', FILE_STORAGE: 'bd' })
    assert.equal(diagnosticCli.status, 0)
    assert.equal(diagnosticCli.output.pendientes, 3)
    assert.equal(cli(['--ejecutar']).status, 1)
    assert.equal(cli(['--diagnostico'], { MIGRATION_DATABASE_URL: '' }).status, 1)
    const rollback = new Error('synthetic rollback')
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DROP TABLE "archivos_migraciones"`
      const oldSchema = await diagnose(tx)
      assert.equal(oldSchema.esquemaListo, false)
      assert.equal(oldSchema.pendientes, 3)
      throw rollback
    }), (error) => error === rollback)
    console.log('OK migracion: diagnostico READ ONLY sin S3 ni escrituras; CLI exige destino y confirmacion explicitos.')

    const firstFailure = await migrate({ prisma, storage: {
      enabled: true, writeOnce: async () => { throw new Error('synthetic network failure') },
    }, limit: 1 })
    assert.equal(firstFailure.fallidos, 1)
    assert.deepEqual(firstFailure.errores, { ALMACENAMIENTO_O_CONEXION: 1 })
    const failed = await prisma.archivoMigracion.findFirstOrThrow({ include: { archivo: true } })
    assert.equal(failed.estado, 'FALLIDO')
    assert.equal(failed.archivo.estado, 'MIGRANDO')
    assert.equal(await prisma.archivoCarga.count(), 1)
    const corrupt = await migrate({ prisma, storage: {
      enabled: true, writeOnce: storage.writeOnce.bind(storage),
      read: async (_key, size) => Buffer.alloc(size),
    }, limit: 1 })
    assert.equal(corrupt.errores.VERIFICACION_S3, 1)
    assert.equal(await prisma.archivoCarga.count(), 1)
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: failed.archivoId } })).estado, 'MIGRANDO')
    const resumed = await migrate({ prisma, storage, limit: 1 })
    assert.equal(resumed.migrados, 1, JSON.stringify(resumed))
    assert.equal(resumed.diagnostico.pendientes, 2)
    assert.equal(await prisma.archivoCarga.count(), 1)
    assert.equal((await prisma.archivoMigracion.findFirstOrThrow()).archivoId, failed.archivoId)
    const rest = await migrate({ prisma, storage })
    assert.equal(rest.migrados, 2)
    const stableCount = await prisma.archivoCarga.count()
    const repeated = await migrate({ prisma, storage })
    assert.equal(repeated.migrados, 0)
    assert.equal(repeated.omitidos, 3)
    assert.equal(await prisma.archivoCarga.count(), stableCount)
    assert.equal((await prisma.recuperador.findUniqueOrThrow({ where: { id_recuperador: recuperador.id_recuperador } })).foto, photo)
    assert.deepEqual(Buffer.from((await prisma.recuperadorDocumento.findUniqueOrThrow({ where: { id: recuperador.documentos[0].id } })).contenido), pdf)
    for (const file of await prisma.archivoCarga.findMany({ where: { estado: 'VINCULADO' } })) {
      assert.equal(hash(await storage.read(file.clave, file.tamano)), file.sha256)
    }
    console.log('OK migracion: fallos persistidos, checksum remoto, reanudacion misma clave, lotes e idempotencia; originales intactos.')
    const tamperedKey = `archivos/${randomUUID()}`
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_FILES_BUCKET, Key: tamperedKey, Body: Buffer.alloc(pdf.length), ContentType: 'application/pdf' }))
    await assert.rejects(storage.writeOnce(tamperedKey, pdf, 'application/pdf', hash(pdf)), (error) => error.name === 'ConflictError')
    console.log('OK migracion: objetos existentes con bytes distintos no se sobrescriben ni se aceptan.')

    const newDoc = () => prisma.ecaAdjunto.create({ data: { id_eca: eca.id_eca, nombre: 'synthetic.pdf', tamano: pdf.length, contenido: pdf } })
    await newDoc()
    const concurrent = await Promise.all([migrate({ prisma, storage }), migrate({ prisma, storage })])
    assert.equal(concurrent.reduce((sum, item) => sum + item.migrados, 0), 1)
    assert.equal(await prisma.archivoCarga.count(), stableCount + 1)
    console.log('OK migracion: ejecuciones concurrentes no duplican objetos ni referencias.')

    const changedDoc = await newDoc()
    let changed = false
    const changeDuringRead = {
      enabled: true, writeOnce: storage.writeOnce.bind(storage),
      read: async (key, size) => {
        const bytes = await storage.read(key, size)
        if (!changed) {
          await prisma.ecaAdjunto.update({ where: { id: changedDoc.id }, data: { nombre: 'changed.pdf' } })
          changed = true
        }
        return bytes
      },
    }
    const changedResult = await migrate({ prisma, storage: changeDuringRead, limit: 1 })
    assert.equal(changedResult.cambiados, 1)
    const changedRecord = await prisma.archivoMigracion.findFirstOrThrow({ where: { origen: 'eca', origenId: changedDoc.id } })
    assert.equal(changedRecord.estado, 'CAMBIADO')
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: changedRecord.archivoId } })).estado, 'RETIRADO')
    assert.equal(await prisma.archivoCarga.count({ where: { estado: 'VINCULADO', uso: 'eca', vinculoId: changedDoc.id } }), 0)
    assert.equal((await migrate({ prisma, storage })).migrados, 1)
    assert.equal(await prisma.archivoMigracion.count({ where: { origen: 'eca', origenId: changedDoc.id } }), 2)
    const deletedDoc = await newDoc()
    const deletedResult = await migrate({ prisma, storage: {
      enabled: true, writeOnce: storage.writeOnce.bind(storage),
      read: async (key, size) => {
        const bytes = await storage.read(key, size)
        await prisma.ecaAdjunto.delete({ where: { id: deletedDoc.id } })
        return bytes
      },
    }, limit: 1 })
    assert.equal(deletedResult.cambiados, 1)
    console.log('OK migracion: cambios o eliminacion durante copia impiden vincular; una nueva version tiene su propio registro.')

    const invalid = await prisma.ecaAdjunto.create({ data: { id_eca: eca.id_eca, nombre: 'invalid.pdf', tamano: 10, contenido: Buffer.alloc(10) } })
    const beforeInvalid = await prisma.archivoCarga.count()
    assert.equal((await diagnose(prisma)).invalidos, 1)
    assert.equal((await migrate({ prisma, storage })).fallidos, 1)
    assert.equal(await prisma.archivoCarga.count(), beforeInvalid)
    await prisma.ecaAdjunto.delete({ where: { id: invalid.id } })
    await newDoc()
    const cliResult = cli(['--ejecutar', '--confirmar-copia', '--limite', '1'])
    assert.equal(cliResult.status, 0)
    assert.equal(cliResult.output.migrados, 1)
    assert.equal(cliResult.output.diagnostico.pendientes, 0)
    assert.equal(cliResult.output.diagnostico.invalidos, 0)
    assert.ok(!JSON.stringify(cliResult.output).includes('synthetic.pdf'))
    assert.equal((await prisma.ecaAdjunto.findMany({ where: { contenido: null } })).length, 0)
    console.log('OK migracion: archivos invalidos bloqueados, CLI de copia probado y resumen sin nombres ni datos personales.')
    const cleanupId = randomUUID()
    await prisma.archivoCarga.create({ data: {
      id: cleanupId, uso: 'eca', nombre: 'synthetic.pdf', mime: 'application/pdf', tamano: pdf.length, sha256: hash(pdf),
      clave: `archivos/${cleanupId}`, claveTemporal: `pendientes/${cleanupId}`, estado: 'PENDIENTE', expiraEn: new Date(0),
    } })
    const { handler: cleanup } = require('./dist/cleanup-files')
    await assert.rejects(cleanup({ operation: 'unexpected' }), /no permitida/)
    const cleaned = await cleanup({ operation: 'cleanup-files' })
    assert.equal(cleaned.eliminados, 1)
    assert.equal(await prisma.archivoCarga.count({ where: { id: cleanupId } }), 0)
    assert.ok(await prisma.archivoCarga.count({ where: { estado: 'VINCULADO' } }) > 0)
    console.log('OK: handler de limpieza separado usa servicio existente, elimina abandonados y conserva vinculados.')
  } finally {
    await prisma.$disconnect()
    s3.destroy()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : 'Fallo en prueba de migracion sintetica')
  process.exitCode = 1
})
