const { spawnSync } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync, rmdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) throw new Error(`Fallo ${program} ${args[0]}; despliegue detenido`)
  return result.stdout?.trim()
}
const aws = (...args) => command('aws', [...args, '--no-cli-pager'])
const json = (...args) => JSON.parse(aws(...args, '--output', 'json'))

async function main() {
  const env = process.env
  for (const key of ['AWS_ACCOUNT_ID', 'FRONTEND_BUCKET', 'CLOUDFRONT_DISTRIBUTION_ID', 'API_URL', 'FRONTEND_URL', 'GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']) {
    if (!env[key]) throw new Error(`Falta ${key}`)
  }
  if (env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA)) throw new Error('Solo se permite main con commit completo')
  if (json('sts', 'get-caller-identity').Account !== env.AWS_ACCOUNT_ID) throw new Error('Cuenta AWS incorrecta')
  const registry = `${env.AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com`
  const repository = `${registry}/cocjant-staging-api`
  const password = aws('ecr', 'get-login-password', '--region', 'us-east-1')
  command('docker', ['login', '--username', 'AWS', '--password-stdin', registry], { input: password, stdio: ['pipe', 'pipe', 'pipe'] })
  const images = {}
  const tags = {}
  for (const [type, target] of [['api', 'runtime'], ['migrate', 'migration']]) {
    const tag = `${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${type}`
    command('docker', ['build', '--platform', 'linux/amd64', '--provenance=false', '--target', target, '-t', `${repository}:${tag}`, 'backend'], { stdio: 'inherit' })
    tags[type] = tag
  }
  command('pwsh', ['-NoProfile', '-File', 'tools/aws/Test-LambdaImage.ps1', '-Image', `${repository}:${tags.api}`,
    '-MigrationImage', `${repository}:${tags.migrate}`, '-SkipBuild', '-S3', '-SchemaExecutor'], { stdio: 'inherit' })
  for (const [type, tag] of Object.entries(tags)) {
    command('docker', ['push', `${repository}:${tag}`], { stdio: 'inherit' })
    const digest = json('ecr', 'describe-images', '--repository-name', 'cocjant-staging-api', '--image-ids', `imageTag=${tag}`).imageDetails[0].imageDigest
    if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Digest ECR invalido')
    images[type] = `${repository}@${digest}`
  }
  const api = env.API_FUNCTION
  const migrator = env.MIGRATION_FUNCTION
  const cleanup = 'cocjant-staging-cleanup'
  const previous = json('lambda', 'get-alias', '--function-name', api, '--name', 'live')
  aws('lambda', 'update-function-code', '--function-name', migrator, '--image-uri', images.migrate)
  aws('lambda', 'wait', 'function-updated-v2', '--function-name', migrator)
  const directory = mkdtempSync(join(tmpdir(), 'cocjant-deploy-'))
  const output = join(directory, 'response.json')
  let version
  try {
    const invocation = json('lambda', 'invoke', '--function-name', migrator, '--cli-binary-format', 'raw-in-base64-out',
      '--payload', '{"operation":"schema-deploy"}', '--cli-read-timeout', '910', output)
    if (invocation.FunctionError || JSON.parse(readFileSync(output, 'utf8')).ok !== true) throw new Error('Migracion fallida; no se cambia el alias')
    aws('lambda', 'update-function-code', '--function-name', api, '--image-uri', images.api)
    aws('lambda', 'wait', 'function-updated-v2', '--function-name', api)
    version = json('lambda', 'publish-version', '--function-name', api, '--description', env.GITHUB_SHA).Version
    const event = {
      version: '2.0', routeKey: '$default', rawPath: '/auth/profile', rawQueryString: '',
      headers: { host: new URL(env.API_URL).host, origin: env.FRONTEND_URL },
      requestContext: { http: { method: 'GET', path: '/auth/profile', sourceIp: '127.0.0.1', protocol: 'HTTP/1.1' }, requestId: 'deployment-smoke', stage: '$default' },
      isBase64Encoded: false,
    }
    const smoke = json('lambda', 'invoke', '--function-name', api, '--qualifier', version, '--cli-binary-format', 'raw-in-base64-out', '--payload', JSON.stringify(event), output)
    const response = JSON.parse(readFileSync(output, 'utf8'))
    if (smoke.FunctionError || response.statusCode !== 401) throw new Error('La version nueva no supera el humo; alias sin cambios')
    aws('lambda', 'update-function-code', '--function-name', cleanup, '--image-uri', images.api)
    aws('lambda', 'wait', 'function-updated-v2', '--function-name', cleanup)
  } finally {
    rmSync(output, { force: true })
    rmdirSync(directory)
  }
  aws('lambda', 'update-alias', '--function-name', api, '--name', 'live', '--function-version', version, '--revision-id', previous.RevisionId)
  try {
    const smoke = await fetch(`${env.API_URL}/auth/profile`, { headers: { Origin: env.FRONTEND_URL }, signal: AbortSignal.timeout(35_000) })
    if (smoke.status !== 401 || smoke.headers.get('access-control-allow-origin') !== env.FRONTEND_URL) throw new Error('Fallo HTTP/CORS tras despliegue')
  } catch (error) {
    aws('lambda', 'update-alias', '--function-name', api, '--name', 'live', '--function-version', previous.FunctionVersion)
    throw error
  }
  aws('s3', 'cp', 'frontend/dist/assets', `s3://${env.FRONTEND_BUCKET}/assets/`, '--recursive', '--cache-control', 'public,max-age=31536000,immutable', '--only-show-errors')
  aws('s3', 'sync', 'frontend/dist', `s3://${env.FRONTEND_BUCKET}`, '--exclude', 'assets/*', '--exclude', 'index.html', '--cache-control', 'public,max-age=300', '--only-show-errors')
  aws('s3', 'cp', 'frontend/dist/index.html', `s3://${env.FRONTEND_BUCKET}/index.html`, '--content-type', 'text/html', '--cache-control', 'no-cache', '--only-show-errors')
  aws('cloudfront', 'create-invalidation', '--distribution-id', env.CLOUDFRONT_DISTRIBUTION_ID, '--paths', '/*')
  const page = await fetch(`${env.FRONTEND_URL}/login`, { signal: AbortSignal.timeout(35_000) })
  if (!page.ok || !page.headers.get('content-type')?.includes('text/html')) throw new Error('Fallo humo SPA; revisar publicacion de frontend')
  console.log(JSON.stringify({ commit: env.GITHUB_SHA, images, version, previousVersion: previous.FunctionVersion, status: 'staging-deployed' }))
}

module.exports = { main }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
