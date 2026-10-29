const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { runInNewContext } = require('node:vm')
const { writeFileSync } = require('node:fs')
const root = join(__dirname, '..', '..')

function cloudformation(name) {
  const yaml = require(join(root, 'backend', 'node_modules', 'js-yaml'))
  const scalar = ['Sub', 'Ref', 'GetAtt', 'GetAZs'].map((name) => yaml.defineScalarTag(`!${name}`, {
    resolve: (value) => ({ [name === 'Ref' ? name : `Fn::${name}`]: name === 'GetAtt' ? value.split('.') : value }),
  }))
  const sequence = ['Equals', 'Select', 'If', 'Not'].map((name) => yaml.defineSequenceTag(`!${name}`, {
    create: () => [], addItem: (items, item) => { items.push(item) },
    finalize: (items) => ({ [`Fn::${name}`]: items }),
  }))
  return yaml.load(readFileSync(join(root, 'infra', 'cloudformation', `${name}.yml`), 'utf8'),
    { schema: new yaml.Schema([...yaml.CORE_SCHEMA.tags, ...scalar, ...sequence]) })
}

test('SPA conserva archivos y reescribe rutas de React', () => {
  const context = {}
  const template = cloudformation('application')
  runInNewContext(template.Resources.SpaFunction.Properties.FunctionCode, context)
  for (const uri of ['/', '/login', '/caracterizar/recuperadores', '/balance-masas/']) {
    assert.equal(context.handler({ request: { uri } }).uri, '/index.html')
  }
  for (const uri of ['/assets/main-123.js', '/logo.png', '/missing.pdf']) {
    assert.equal(context.handler({ request: { uri } }).uri, uri)
  }
})

test('API provisional conserva query/cookies y no usa cache ni reescritura SPA', () => {
  const template = cloudformation('application')
  const behaviors = template.Resources.Distribution.Properties.DistributionConfig.CacheBehaviors['Fn::If']
  assert.equal(behaviors[0], 'ProvisionalDomain')
  const behavior = behaviors[1][0]
  assert.equal(behavior.PathPattern, '/api/*')
  assert.equal(behavior.CachePolicyId, '413f1600-6f9c-4c8f-a2a5-05bbdb3ca7b2')
  assert.equal(behavior.OriginRequestPolicyId, 'b689b0a8-53d0-40ab-baf2-68738e2966ac')
  const context = {}
  runInNewContext(template.Resources.ApiPathFunction.Properties.FunctionCode, context)
  const request = { uri: '/api/auth/refresh', querystring: { page: { value: '2' } }, cookies: { refresh_token: { value: 'synthetic' } } }
  assert.equal(context.handler({ request }), request)
  assert.equal(request.uri, '/auth/refresh')
  assert.equal(request.cookies.refresh_token.value, 'synthetic')
  assert.equal(request.querystring.page.value, '2')
  assert.deepEqual(template.Resources.Api.Properties.Environment.Variables.COOKIE_PATH['Fn::If'], ['CustomDomain', '/auth', '/api/auth'])
  for (const id of ['Api', 'Migrator', 'Cleanup']) {
    assert.equal(template.Resources[id].Properties.ReservedConcurrentExecutions['Fn::If'][0], 'Reserved')
  }
})

test('CloudFormation conserva datos, secretos separados y limpieza desactivada', () => {
  const bootstrap = cloudformation('bootstrap')
  const foundation = cloudformation('foundation')
  const app = cloudformation('application')
  assert.equal(bootstrap.Resources.Repository.DeletionPolicy, 'Retain')
  assert.ok(!JSON.stringify(bootstrap).includes('tfstate'))
  for (const id of ['Database', 'Writer', 'FilesBucket', 'FrontendBucket', 'ApplicationSecret', 'MigrationSecret']) {
    assert.equal(foundation.Resources[id].DeletionPolicy, 'Retain')
    assert.equal(foundation.Resources[id].UpdateReplacePolicy, 'Retain')
  }
  assert.equal(foundation.Resources.Database.Properties.DeletionProtection, true)
  assert.equal(foundation.Resources.Writer.Properties.PubliclyAccessible, false)
  assert.equal(foundation.Resources.ApplicationSecret.Properties.SecretString, '{}')
  assert.equal(app.Resources.CleanupSchedule.Properties.State, 'DISABLED')
  assert.equal(app.Resources.Migrator.Properties.Timeout, 900)
  assert.equal(app.Resources.Api.Properties.Timeout, 28)
  assert.notDeepEqual(app.Resources.ApiRole.Properties.Policies[0], app.Resources.MigrationRole.Properties.Policies[0])
  const deploy = JSON.stringify(app.Resources.DeployRole)
  assert.ok(!deploy.includes('cloudformation:'))
  assert.ok(!deploy.includes('secretsmanager:GetSecretValue'))
})

async function deploymentScenario(failure) {
  const calls = []
  const environment = {
    AWS_ACCOUNT_ID: '123456789012', FRONTEND_BUCKET: 'synthetic-frontend', CLOUDFRONT_DISTRIBUTION_ID: 'synthetic',
    API_URL: 'https://api.example.test', FRONTEND_URL: 'https://app.example.test',
    GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_REF: 'refs/heads/main',
    API_FUNCTION: 'cocjant-staging-api', MIGRATION_FUNCTION: 'cocjant-staging-migrate',
  }
  const spawnSync = (program, args) => {
    calls.push({ program, args })
    if (program !== 'aws') return { status: 0, stdout: '' }
    const operation = `${args[0]} ${args[1]}`
    let response = {}
    if (operation === 'sts get-caller-identity') response = { Account: environment.AWS_ACCOUNT_ID }
    if (operation === 'ecr get-login-password') return { status: 0, stdout: 'synthetic' }
    if (operation === 'ecr describe-images') response = { imageDetails: [{ imageDigest: `sha256:${'b'.repeat(64)}` }] }
    if (operation === 'lambda get-alias') response = { FunctionVersion: '1', RevisionId: 'original' }
    if (operation === 'lambda publish-version') response = { Version: '2' }
    if (operation === 'lambda invoke') {
      const schema = !args.includes('--qualifier')
      const file = args.find((value) => value.endsWith('response.json'))
      writeFileSync(file, JSON.stringify(schema ? { ok: failure !== 'migration' } : { statusCode: failure === 'version' ? 500 : 401 }))
    }
    return { status: 0, stdout: JSON.stringify(response) }
  }
  const context = {
    module: { exports: {} },
    require: (id) => id === 'node:child_process' ? { spawnSync } : require(id),
    process: { env: environment },
    URL, AbortSignal,
    fetch: async (url) => url.includes('/auth/profile')
      ? { status: failure === 'public' ? 500 : 401, headers: new Map([['access-control-allow-origin', environment.FRONTEND_URL]]) }
      : { ok: true, headers: new Map([['content-type', 'text/html']]) },
    console: { log: () => {} },
  }
  runInNewContext(readFileSync(join(__dirname, 'deploy-staging.cjs'), 'utf8'), context)
  let error
  try { await context.module.exports.main() } catch (caught) { error = caught }
  return { calls, error }
}

test('CD valida las mismas imagenes antes de publicar y migra antes de cambiar alias', async () => {
  const { calls, error } = await deploymentScenario()
  assert.equal(error, undefined)
  const test = calls.findIndex((call) => call.program === 'pwsh')
  const push = calls.findIndex((call) => call.program === 'docker' && call.args[0] === 'push')
  const migrate = calls.findIndex((call) => call.args[0] === 'lambda' && call.args[1] === 'invoke')
  const alias = calls.findIndex((call) => call.args[0] === 'lambda' && call.args[1] === 'update-alias')
  const html = calls.findIndex((call) => call.args.includes('frontend/dist/index.html'))
  assert.ok(test < push && push < migrate && migrate < alias && alias < html)
  assert.ok(calls.some((call) => call.args.includes('frontend/dist/assets')))
  assert.ok(!calls.some((call) => call.args.includes('--delete')))
})

test('CD conserva alias y frontend si falla migracion o humo de version', async () => {
  for (const failure of ['migration', 'version']) {
    const { calls, error } = await deploymentScenario(failure)
    assert.ok(error)
    assert.ok(!calls.some((call) => call.args[0] === 'lambda' && call.args[1] === 'update-alias'))
    assert.ok(!calls.some((call) => call.args[0] === 's3'))
  }
})

test('CD restaura alias previo si falla humo publico sin revertir esquema', async () => {
  const { calls, error } = await deploymentScenario('public')
  assert.ok(error)
  const aliases = calls.filter((call) => call.args[0] === 'lambda' && call.args[1] === 'update-alias')
  assert.equal(aliases.length, 2)
  assert.ok(aliases[1].args.includes('1'))
  assert.ok(!calls.some((call) => call.args[0] === 's3'))
})
