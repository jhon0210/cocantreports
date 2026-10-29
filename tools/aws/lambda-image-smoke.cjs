const assert = require('node:assert/strict')
const syntheticPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0, 128, 255]), Buffer.from('\n%%EOF')])

function assertDisposableDatabase() {
  const url = new URL(process.env.DATABASE_URL)
  assert.match(url.hostname, /^cocjant-db-[a-f0-9]{12}$/)
  assert.equal(url.pathname, '/cocjant_check')
  assert.equal(url.username, 'cocjant_check')
}

async function inspect() {
  const fs = require('node:fs')
  for (const path of ['.env', '.git', 'seeders', 'prisma/migrations', 'tools/migrate-files.cjs', 'node_modules/prisma/build/index.js']) {
    assert.equal(fs.existsSync(path), false, `Archivo no permitido en runtime: ${path}`)
  }
  require('./dist/lambda')
  await require('bcrypt').hash('synthetic', 10)
  console.log('Runtime no-root: handler y bcrypt disponibles; sin .env, Git, seeders ni migraciones.')
}

async function prepare() {
  assertDisposableDatabase()
  const { PrismaClient } = require('@prisma/client')
  const bcrypt = require('bcrypt')
  const prisma = new PrismaClient()
  try {
    await prisma.rol.upsert({ where: { id_perfil: 1 }, create: { id_perfil: 1, perfil: 'Administrador' }, update: {} })
    await prisma.usuario.create({
      data: {
        usuario: 'lambda.synthetic',
        nomUser: 'Synthetic',
        apeUser: 'Lambda',
        clave: await bcrypt.hash(process.env.SMOKE_PASSWORD, 10),
        id_perfil: 1,
      },
    })
    await prisma.rol.create({ data: { id_perfil: 3, perfil: 'Operario' } })
    for (const [usuario, id_perfil] of [['lambda.other', 1], ['lambda.operator', 3]]) {
      await prisma.usuario.create({ data: { usuario, nomUser: 'Synthetic', apeUser: 'Other', clave: await bcrypt.hash(process.env.SMOKE_PASSWORD, 10), id_perfil } })
    }
    await prisma.estadoRecuperador.upsert({ where: { id_estado: 1 }, create: { id_estado: 1, nombre: 'Activo' }, update: {} })
    await prisma.eca.create({
      data: {
        nomEca: 'ECA Synthetic Lambda',
        adjuntos: { create: { nombre: 'synthetic.pdf', tamano: syntheticPdf.length, contenido: syntheticPdf } },
      },
    })
    console.log('Prisma Linux y bcrypt: datos sinteticos preparados en PostgreSQL desechable.')
  } finally {
    await prisma.$disconnect()
  }
}

function event(path, method = 'GET', body, authorization, cookies) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: {
      host: 'api.example.test',
      origin: 'https://app.example.test',
      'content-type': 'application/json',
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    },
    cookies,
    requestContext: {
      accountId: 'synthetic', apiId: 'synthetic',
      domainName: 'api.example.test', domainPrefix: 'api',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'synthetic' },
      requestId: 'synthetic', routeKey: '$default', stage: '$default', time: '', timeEpoch: 0,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    isBase64Encoded: false,
  }
}

async function invoke(input) {
  const response = await fetch(`${process.env.SMOKE_LAMBDA_URL}/2015-03-31/functions/function/invocations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(45_000),
  })
  assert.equal(response.status, 200, 'El emulador debe responder HTTP 200')
  const result = await response.json()
  assert.equal(typeof result.statusCode, 'number', 'Lambda debe producir una respuesta HTTP, no un fallo de inicializacion')
  return result
}

async function verify() {
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(process.env.SMOKE_LAMBDA_URL, { signal: AbortSignal.timeout(1000) })
      ready = true
      break
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  assert.ok(ready, 'El emulador Lambda debe iniciar en 60 segundos')
  const unauthorized = await invoke(event('/auth/profile'))
  assert.equal(unauthorized.statusCode, 401)
  console.log('OK: arranque frio, Prisma y endpoint protegido.')

  const invalid = await invoke(event('/auth/login', 'POST', { usuario: 'lambda.synthetic', clave: process.env.SMOKE_PASSWORD, unexpected: true }))
  assert.equal(invalid.statusCode, 400)
  console.log('OK: validaciones HTTP API.')

  const login = await invoke(event('/auth/login', 'POST', { usuario: 'lambda.synthetic', clave: process.env.SMOKE_PASSWORD }))
  assert.equal(login.statusCode, 200, 'Login sintetico')
  const token = JSON.parse(login.body).access_token
  assert.ok(token)
  assert.ok(login.cookies?.some((cookie) => /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /Path=\/auth/.test(cookie)))
  assert.equal(login.headers['access-control-allow-origin'], 'https://app.example.test')
  assert.equal(login.headers['access-control-allow-credentials'], 'true')
  console.log('OK: login real, bcrypt Linux, JWT, cookies seguras y CORS.')

  const profile = await invoke(event('/auth/profile', 'GET', undefined, token))
  assert.equal(profile.statusCode, 200)
  assert.equal(JSON.parse(profile.body).usuario, 'lambda.synthetic')
  console.log('OK: invocacion caliente autenticada.')

  const ecas = await invoke(event('/ecas', 'GET', undefined, token))
  assert.equal(ecas.statusCode, 200)
  const eca = JSON.parse(ecas.body).find((item) => item.nomEca === 'ECA Synthetic Lambda')
  assert.ok(eca?.adjuntos?.length)
  const pdf = await invoke(event(`/ecas/${eca.id_eca}/adjuntos/${eca.adjuntos[0].id}`, 'GET', undefined, token))
  assert.equal(pdf.statusCode, 200)
  assert.equal(pdf.isBase64Encoded, true)
  assert.equal(pdf.headers['content-type'], 'application/pdf')
  assert.deepEqual(Buffer.from(pdf.body, 'base64'), syntheticPdf)
  console.log('OK: autorizacion y descarga PDF binaria sin corrupcion.')
  if (process.env.SMOKE_S3 === 'true') await verifyStorage(token)
  else await verifyLegacy(token)

  const cookie = login.cookies.find((value) => value.startsWith('refresh_token=')).split(';')[0]
  const refreshed = await invoke(event('/auth/refresh', 'POST', undefined, undefined, [cookie]))
  assert.equal(refreshed.statusCode, 200)
  assert.ok(JSON.parse(refreshed.body).access_token)
  const rotated = refreshed.cookies.find((value) => value.startsWith('refresh_token=')).split(';')[0]
  assert.notEqual(rotated, cookie)
  console.log('OK: renovacion y rotacion de refresh token.')

  const logout = await invoke(event('/auth/logout', 'POST', undefined, undefined, [rotated]))
  assert.equal(logout.statusCode, 204)
  const rejected = await invoke(event('/auth/refresh', 'POST', undefined, undefined, [rotated]))
  assert.equal(rejected.statusCode, 401)
  console.log('OK: cierre y revocacion de sesion.')
}

const action = process.argv[2]
async function prepareStorage() {
  const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3')
  const client = new S3Client({ region: 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true })
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${process.env.S3_ENDPOINT}/moto-api/`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) { ready = true; break }
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  assert.ok(ready, 'S3 local debe responder en 60 segundos')
  await client.send(new CreateBucketCommand({ Bucket: process.env.S3_FILES_BUCKET }))
  console.log('OK: bucket S3 privado desechable, sin credenciales AWS reales.')
}

async function verifyStorage(token) {
  assertDisposableDatabase()
  const { PrismaClient } = require('@prisma/client')
  const { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
  const { createHash } = require('node:crypto')
  const prisma = new PrismaClient()
  const s3 = new S3Client({ region: 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true })
  const checksum = (bytes) => createHash('sha256').update(bytes).digest('base64')
  const request = async (path, method, body, expected, who = token) => {
    if (path === '/ecas' && method === 'POST') body = { direccion: 'Synthetic test address', ...body }
    const result = await invoke(event(path, method, body, who))
    assert.equal(result.statusCode, expected, `${method} ${path}: ${result.body?.substring(0, 250)}`)
    return result.body ? JSON.parse(result.body) : undefined
  }
  const login = async (usuario) => (await request('/auth/login', 'POST', { usuario, clave: process.env.SMOKE_PASSWORD }, 200)).access_token
  const authorize = async (uso = 'eca', bytes = syntheticPdf, nombre = 'synthetic.pdf', mime = 'application/pdf', who = token) =>
    request('/archivos/autorizar', 'POST', { uso, nombre, mime, tamano: bytes.length, sha256: checksum(bytes) }, 201, who)
  const post = async (ticket, bytes) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(ticket.fields)) form.append(key, value)
    form.append('file', new Blob([bytes]), 'synthetic')
    return fetch(ticket.url, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) })
  }
  const upload = async (uso = 'eca', bytes = syntheticPdf, nombre = 'synthetic.pdf', mime = 'application/pdf') => {
    const ticket = await authorize(uso, bytes, nombre, mime)
    const response = await post(ticket, bytes)
    assert.ok(response.ok, `La carga S3 directa debe funcionar (${response.status}: ${await response.text()})`)
    await request(`/archivos/${ticket.id}/confirmar`, 'POST', undefined, 201)
    return ticket.id
  }
  try {
    assert.deepEqual(await request('/archivos/config', 'GET', undefined, 200), { almacenamiento: 's3' })
    const operator = await login('lambda.operator')
    const other = await login('lambda.other')
    await request('/archivos/autorizar', 'POST', {}, 403, operator)
    const ownerTicket = await authorize()
    await request(`/archivos/${ownerTicket.id}/confirmar`, 'POST', undefined, 403, other)
    await request('/archivos/autorizar', 'POST', { uso: 'eca', nombre: 'a.pdf', mime: 'application/pdf', tamano: 2097153, sha256: checksum(syntheticPdf) }, 400)
    const oversized = await post(ownerTicket, Buffer.concat([syntheticPdf, Buffer.from('too-large')]))
    const policy = JSON.parse(Buffer.from(ownerTicket.fields.Policy, 'base64').toString('utf8'))
    assert.ok(policy.conditions.some((condition) => Array.isArray(condition) && condition[0] === 'content-length-range' && condition[1] === syntheticPdf.length && condition[2] === syntheticPdf.length))
    if (oversized.ok) await request(`/archivos/${ownerTicket.id}/confirmar`, 'POST', undefined, 400)
    const corrupted = Buffer.from(syntheticPdf)
    corrupted[0] = 0
    const corruptUpload = await post(ownerTicket, corrupted)
    if (corruptUpload.ok) await request(`/archivos/${ownerTicket.id}/confirmar`, 'POST', undefined, 400)
    console.log('OK: roles, propietario, politica firmada, validacion de tamano y checksum de carga.')

    const largePdf = Buffer.alloc(2 * 1024 * 1024, 32)
    largePdf.write('%PDF-1.7\n', 0)
    largePdf.write('%%EOF', largePdf.length - 5)
    const ready = await upload('eca', largePdf)
    const readyMeta = await prisma.archivoCarga.findUniqueOrThrow({ where: { id: ready } })
    const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_FILES_BUCKET}/${readyMeta.clave}`)
    assert.equal(anonymous.status, 403, 'El bucket debe permanecer privado')
    await assert.rejects(s3.send(new PutObjectCommand({
      Bucket: process.env.S3_FILES_BUCKET, Key: readyMeta.clave, Body: corrupted, IfNoneMatch: '*',
    })), (error) => error.$metadata.httpStatusCode === 412)
    await request('/ecas', 'POST', { nomEca: 'Owner denied', adjuntos: [{ archivo_id: ready }] }, 403, other)
    const otherTicket = await authorize('eca', syntheticPdf, 'synthetic.pdf', 'application/pdf', other)
    await prisma.usuario.delete({ where: { usuario: 'lambda.other' } })
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: otherTicket.id } })).propietarioId, null)
    const rollback = await upload()
    const beforeRollback = await prisma.eca.count()
    await request('/ecas', 'POST', { nomEca: 'Rollback', adjuntos: [{ archivo_id: rollback }, { archivo_id: rollback }] }, 409)
    assert.equal(await prisma.eca.count(), beforeRollback)
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: rollback } })).estado, 'LISTO')
    const eca = await request('/ecas', 'POST', { nomEca: 'S3 synthetic', adjuntos: [{ archivo_id: ready }] }, 201)
    const ecaDoc = await prisma.ecaAdjunto.findUniqueOrThrow({ where: { id: eca.adjuntos[0].id } })
    assert.equal(ecaDoc.contenido, null, 'La BD solo debe guardar metadatos')
    await request('/ecas', 'POST', { nomEca: 'Replay', adjuntos: [{ archivo_id: ready }] }, 409)
    await request('/ecas', 'POST', { nomEca: 'Inline denied', adjuntos: [{ nombre: 'legacy.pdf', contenido: syntheticPdf.toString('base64') }] }, 400)
    const download = await invoke(event(`/ecas/${eca.id_eca}/adjuntos/${ecaDoc.id}`, 'GET', undefined, token))
    assert.equal(download.statusCode, 200)
    assert.deepEqual(Buffer.from(download.body, 'base64'), largePdf)
    console.log('OK: privado, final inmutable, rollback, una vinculacion y descarga ECA byte por byte.')

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXp0AAAAASUVORK5CYII=', 'base64')
    const photoId = await upload('foto', png, 'foto.png', 'image/png')
    const largeDoc = Buffer.alloc(1024 * 1024, 32)
    largeDoc.write('%PDF-1.7\n', 0)
    largeDoc.write('%%EOF', largeDoc.length - 5)
    const docId = await upload('identificacion', largeDoc)
    await request('/archivos/autorizar', 'POST', { uso: 'salud', nombre: 'a.pdf', mime: 'application/pdf', tamano: 1024 * 1024 + 1, sha256: checksum(syntheticPdf) }, 400)
    await request('/archivos/autorizar', 'POST', { uso: 'foto', nombre: 'foto.png', mime: 'image/png', tamano: 1_125_001, sha256: checksum(png) }, 400)
    const recuperador = await request('/recuperadores', 'POST', {
      nombre: 'Synthetic', apellido: 'Storage', cedula: '99999900001', bancarizado: false,
      foto_archivo_id: photoId, documentos: [{ tipo: 'identificacion', archivo_id: docId }],
    }, 201)
    const persisted = await prisma.recuperador.findUniqueOrThrow({ where: { id_recuperador: recuperador.id_recuperador }, include: { documentos: true } })
    assert.equal(persisted.foto, `s3:${photoId}`)
    assert.equal(persisted.documentos[0].contenido, null)
    assert.ok(recuperador.foto.startsWith(process.env.S3_ENDPOINT), 'Foto debe ser URL firmada')
    assert.deepEqual(Buffer.from(await (await fetch(recuperador.foto)).arrayBuffer()), png)
    const documento = await invoke(event(`/recuperadores/${persisted.id_recuperador}/documentos/${persisted.documentos[0].id}`, 'GET', undefined, token))
    assert.equal(documento.statusCode, 200)
    assert.deepEqual(Buffer.from(documento.body, 'base64'), largeDoc)
    const migratedRow = await prisma.recuperador.findUniqueOrThrow({ where: { cedula: '99999900003' }, include: { documentos: true } })
    const migratedDetail = await request(`/recuperadores/${migratedRow.id_recuperador}`, 'GET', undefined, 200)
    assert.ok(migratedRow.foto.startsWith('data:image/'), 'La migracion no elimina la foto original')
    assert.ok(migratedDetail.foto.startsWith(process.env.S3_ENDPOINT), 'La lectura de foto migrada debe usar S3')
    assert.deepEqual(Buffer.from(await (await fetch(migratedDetail.foto)).arrayBuffer()), png)
    const migratedDoc = await invoke(event(`/recuperadores/${migratedRow.id_recuperador}/documentos/${migratedRow.documentos[0].id}`, 'GET', undefined, token))
    assert.equal(migratedDoc.statusCode, 200)
    assert.deepEqual(Buffer.from(migratedDoc.body, 'base64'), Buffer.from(migratedRow.documentos[0].contenido))
    const migratedFile = await prisma.archivoCarga.findFirstOrThrow({ where: { uso: 'salud', vinculoId: migratedRow.documentos[0].id, estado: 'VINCULADO' } })
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_FILES_BUCKET, Key: migratedFile.clave }))
    const missingMigrated = await invoke(event(`/recuperadores/${migratedRow.id_recuperador}/documentos/${migratedRow.documentos[0].id}`, 'GET', undefined, token))
    assert.equal(missingMigrated.statusCode, 500, 'Un fallo S3 no debe quedar oculto usando la copia BD')
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_FILES_BUCKET, Key: migratedFile.clave, Body: migratedRow.documentos[0].contenido,
      ContentType: migratedFile.mime, ChecksumSHA256: migratedFile.sha256, ServerSideEncryption: 'AES256',
    }))
    console.log('OK: lectura autenticada desde S3 de fotos/documentos migrados, conservando originales en BD.')
    await request(`/recuperadores/${persisted.id_recuperador}`, 'PATCH', { nombre: 'Updated' }, 200)
    assert.equal((await prisma.recuperador.findUniqueOrThrow({ where: { id_recuperador: persisted.id_recuperador } })).foto, `s3:${photoId}`)
    await request(`/recuperadores/${persisted.id_recuperador}`, 'PATCH', { documentos: [] }, 200)
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: docId } })).estado, 'RETIRADO')
    console.log('OK: limites reales 2 MiB/1 MiB, foto firmada, metadatos y edicion sin perder foto.')

    const expired = await upload()
    const expiredPending = await authorize()
    await post(expiredPending, syntheticPdf)
    await prisma.archivoCarga.updateMany({ where: { id: { in: [expired, expiredPending.id] } }, data: { expiraEn: new Date(Date.now() - 3_600_000) } })
    await request(`/archivos/${expiredPending.id}/confirmar`, 'POST', undefined, 409)
    await request('/ecas', 'POST', { nomEca: 'Expired denied', adjuntos: [{ archivo_id: expired }] }, 409)
    await request('/archivos/limpiar', 'POST', undefined, 403, operator)
    const cleanup = await request('/archivos/limpiar', 'POST', undefined, 201)
    assert.equal(cleanup.eliminados, 2)
    assert.equal(await prisma.archivoCarga.count({ where: { id: { in: [expired, expiredPending.id] } } }), 0)
    for (const id of [expired, expiredPending.id]) {
      for (const prefix of ['archivos', 'pendientes']) {
        await assert.rejects(s3.send(new GetObjectCommand({ Bucket: process.env.S3_FILES_BUCKET, Key: `${prefix}/${id}` })), (error) => error.$metadata.httpStatusCode === 404)
      }
    }
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: ready } })).estado, 'VINCULADO')
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: docId } })).estado, 'RETIRADO')
    await request(`/ecas/${eca.id_eca}`, 'DELETE', undefined, 204)
    assert.equal((await prisma.archivoCarga.findUniqueOrThrow({ where: { id: ready } })).estado, 'RETIRADO')
    console.log('OK: expiracion, limpieza de abandonados y conservacion de vinculados/retirados.')
  } finally {
    await prisma.$disconnect()
    s3.destroy()
  }
}

async function verifyLegacy(token) {
  assertDisposableDatabase()
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const request = async (path, method, body, expected) => {
    const result = await invoke(event(path, method, body, token))
    assert.equal(result.statusCode, expected, `${method} ${path}: ${result.body?.substring(0, 250)}`)
    return result.body ? JSON.parse(result.body) : undefined
  }
  try {
    await prisma.$executeRaw`DROP TABLE "archivos_migraciones"`
    await prisma.$executeRaw`DROP TABLE "archivos_cargas"`
    await prisma.$executeRaw`ALTER TABLE "eca_adjuntos" ALTER COLUMN "contenido" SET NOT NULL`
    await prisma.$executeRaw`ALTER TABLE "recuperador_documentos" ALTER COLUMN "contenido" SET NOT NULL`
    assert.deepEqual(await request('/archivos/config', 'GET', undefined, 200), { almacenamiento: 'bd' })
    const eca = await request('/ecas', 'POST', {
      nomEca: 'Legacy ECA', direccion: 'Synthetic address',
      adjuntos: [{ nombre: 'legacy.pdf', contenido: syntheticPdf.toString('base64') }],
    }, 201)
    await request(`/ecas/${eca.id_eca}`, 'PUT', { adjuntos: [{ id: eca.adjuntos[0].id }] }, 200)
    const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXp0AAAAASUVORK5CYII='
    const recuperador = await request('/recuperadores', 'POST', {
      nombre: 'Legacy', apellido: 'Synthetic', cedula: '99999900002', bancarizado: false, foto,
      documentos: [{ tipo: 'salud', nombre: 'legacy.pdf', contenido: syntheticPdf.toString('base64') }],
    }, 201)
    assert.equal(recuperador.foto, foto)
    const updated = await request(`/recuperadores/${recuperador.id_recuperador}`, 'PATCH', { nombre: 'Updated legacy' }, 200)
    assert.equal(updated.foto, foto)
    const doc = await invoke(event(`/recuperadores/${recuperador.id_recuperador}/documentos/${recuperador.documentos[0].id}`, 'GET', undefined, token))
    assert.equal(doc.statusCode, 200)
    assert.deepEqual(Buffer.from(doc.body, 'base64'), syntheticPdf)
    await request(`/recuperadores/${recuperador.id_recuperador}`, 'DELETE', undefined, 204)
    await request(`/ecas/${eca.id_eca}`, 'DELETE', undefined, 204)
    console.log('OK: modo BD crea, edita y elimina con esquema anterior sin tabla S3; conserva foto y documentos.')
  } finally {
    await prisma.$disconnect()
  }
}

async function schema() {
  const { mkdtempSync, writeFileSync, rmSync, rmdirSync } = require('node:fs')
  const { tmpdir } = require('node:os')
  const { join } = require('node:path')
  const { loadConfigFromFile } = require('@prisma/config')
  const directory = mkdtempSync(join(tmpdir(), 'cocjant-prisma-config-'))
  const configFile = join(directory, 'prisma.config.mjs')
  try {
    writeFileSync(configFile, "export default { schema: './schema.prisma', migrations: { path: './migrations' } }\n")
    const result = await loadConfigFromFile({ configFile, configRoot: directory })
    assert.equal(result.error, undefined, 'Prisma debe cargar su configuracion con deepmerge corregido')
    assert.equal(result.config.schema, join(directory, 'schema.prisma'))
    assert.equal(result.config.migrations.path, join(directory, 'migrations'))
    console.log('OK: cargador de configuracion Prisma compatible con deepmerge-ts corregido.')
  } finally {
    rmSync(configFile, { force: true })
    rmdirSync(directory)
  }
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(process.env.SMOKE_LAMBDA_URL, { signal: AbortSignal.timeout(1000) })
      ready = true
      break
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  assert.ok(ready, 'El ejecutor debe responder en 60 segundos')
  for (let run = 0; run < 2; run++) {
    const response = await fetch(`${process.env.SMOKE_LAMBDA_URL}/2015-03-31/functions/function/invocations`, {
      method: 'POST', body: JSON.stringify({ operation: 'schema-deploy' }), signal: AbortSignal.timeout(90000),
    })
    const result = await response.json()
    assert.equal(result.ok, true, 'La migracion Lambda separada debe completar')
    assert.ok(result.elapsedMs < 60000, 'El esquema sintetico debe migrar en menos de 60 segundos')
    console.log(`OK: ejecutor Prisma Lambda no root, ejecucion ${run + 1}, ${result.elapsedMs} ms, sin servidor HTTP Nest.`)
  }
  const invalid = await fetch(`${process.env.SMOKE_LAMBDA_URL}/2015-03-31/functions/function/invocations`, {
    method: 'POST', body: JSON.stringify({ operation: 'unexpected' }), signal: AbortSignal.timeout(10000),
  })
  assert.ok((await invalid.json()).errorType, 'El ejecutor debe rechazar otras operaciones')
}

const actions = { inspect, prepare, verify, schema, 'prepare-storage': prepareStorage }
if (!Object.hasOwn(actions, action)) throw new Error('Usa inspect, prepare o verify')
actions[action]().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Fallo de prueba Lambda')
  process.exitCode = 1
})
