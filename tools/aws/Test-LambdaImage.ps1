param(
    [string]$DockerPath = 'docker',
    [string]$Image = 'cocjant-api:staging',
    [string]$MigrationImage = '',
    [switch]$SkipBuild,
    [switch]$S3,
    [switch]$SchemaExecutor
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$network = "cocjant-check-$suffix"
$database = "cocjant-db-$suffix"
$api = "cocjant-lambda-$suffix"
$buildImage = "cocjant-build-check:$suffix"
$storage = "cocjant-s3-$suffix"
$temporaryMigrationImage = "cocjant-migration-check:$suffix"
if (-not $MigrationImage) { $MigrationImage = $temporaryMigrationImage }
$migrator = "cocjant-migrator-$suffix"
$environmentNames = @('DATABASE_URL', 'POSTGRES_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SMOKE_PASSWORD',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_FILES_BUCKET', 'MIGRATION_DATABASE_URL')
$saved = @{}
foreach ($name in $environmentNames) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Invoke-Docker {
    param([string[]]$Arguments)
    & $DockerPath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker fallo: $($Arguments[0]) (exit $LASTEXITCODE)" }
}

$networkCreated = $false
try {
    $env:POSTGRES_PASSWORD = [Guid]::NewGuid().ToString('N')
    $env:DATABASE_URL = "postgresql://cocjant_check:$($env:POSTGRES_PASSWORD)@${database}:5432/cocjant_check?connection_limit=1"
    $env:JWT_ACCESS_SECRET = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:JWT_REFRESH_SECRET = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:SMOKE_PASSWORD = [Guid]::NewGuid().ToString('N')
    $env:MIGRATION_DATABASE_URL = $env:DATABASE_URL
    $env:AWS_ACCESS_KEY_ID = 'synthetic-' + $suffix
    $env:AWS_SECRET_ACCESS_KEY = [Guid]::NewGuid().ToString('N')
    $env:S3_ENDPOINT = "http://${storage}:5000"
    $env:S3_FILES_BUCKET = 'cocjant-synthetic'
    $storageEnv = @('-e', 'AWS_ACCESS_KEY_ID', '-e', 'AWS_SECRET_ACCESS_KEY', '-e', 'AWS_REGION=us-east-1', '-e', 'S3_ENDPOINT', '-e', 'S3_FILES_BUCKET')

    if (-not $SkipBuild) {
        Invoke-Docker @('build', '--platform', 'linux/amd64', '--provenance=false', '-t', $Image, (Join-Path $root 'backend'))
    }
    $imageInfo = (& $DockerPath image inspect $Image | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0 -or $imageInfo.Os -ne 'linux' -or $imageInfo.Architecture -ne 'amd64') {
        throw 'La imagen debe ser Linux amd64'
    }
    Write-Host "Imagen verificada: $($imageInfo.Id), linux/amd64"
    $probePath = Join-Path $PSScriptRoot 'lambda-image-smoke.cjs'
    Invoke-Docker @('run', '--rm', '--user', '10001:10001', '--entrypoint', 'node',
        '-e', 'DATABASE_URL', '-e', 'JWT_ACCESS_SECRET', '-e', 'JWT_REFRESH_SECRET',
        '--mount', "type=bind,source=$probePath,target=/var/task/lambda-image-smoke.cjs,readonly",
        $Image, 'lambda-image-smoke.cjs', 'inspect')
    Invoke-Docker @('build', '--platform', 'linux/amd64', '--provenance=false', '--target', 'build', '-t', $buildImage, (Join-Path $root 'backend'))
    Invoke-Docker @('network', 'create', $network)
    $networkCreated = $true
    if ($S3) {
        Invoke-Docker @('run', '-d', '--name', $storage, '--network', $network,
            'motoserver/moto:5.1.22')
        Invoke-Docker (@('run', '--rm', '--network', $network, '--entrypoint', 'node') + $storageEnv + @(
            '--mount', "type=bind,source=$probePath,target=/build/lambda-image-smoke.cjs,readonly",
            $buildImage, 'lambda-image-smoke.cjs', 'prepare-storage'))
    }
    Invoke-Docker @('run', '-d', '--name', $database, '--network', $network, '--tmpfs', '/var/lib/postgresql/data',
        '-e', 'POSTGRES_USER=cocjant_check', '-e', 'POSTGRES_DB=cocjant_check', '-e', 'POSTGRES_PASSWORD', 'postgres:16-bookworm')

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        & $DockerPath exec $database pg_isready -U cocjant_check -d cocjant_check *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'PostgreSQL temporal no respondio en 60 segundos' }

    $prismaPath = Join-Path $root 'backend\prisma'
    if ($SchemaExecutor) {
        if (-not $SkipBuild) {
            Invoke-Docker @('build', '--platform', 'linux/amd64', '--provenance=false', '--target', 'migration', '-t', $MigrationImage, (Join-Path $root 'backend'))
        }
        Invoke-Docker @('run', '-d', '--name', $migrator, '--network', $network, '--user', '10001:10001',
            '-e', 'MIGRATION_DATABASE_URL', $MigrationImage)
        Invoke-Docker @('run', '--rm', '--network', $network, '--entrypoint', 'node',
            '-e', "SMOKE_LAMBDA_URL=http://${migrator}:8080",
            '--mount', "type=bind,source=$probePath,target=/build/lambda-image-smoke.cjs,readonly",
            $buildImage, 'lambda-image-smoke.cjs', 'schema')
    } else {
        Invoke-Docker @('run', '--rm', '--network', $network, '--entrypoint', 'node', '-e', 'DATABASE_URL',
            '--mount', "type=bind,source=$prismaPath,target=/verification/prisma,readonly",
            $buildImage, 'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', '/verification/prisma/schema.prisma')
    }
    Invoke-Docker @('run', '--rm', '--network', $network, '--entrypoint', 'node',
        '-e', 'DATABASE_URL', '-e', 'SMOKE_PASSWORD',
        '--mount', "type=bind,source=$probePath,target=/build/lambda-image-smoke.cjs,readonly",
        $buildImage, 'lambda-image-smoke.cjs', 'prepare')

    if ($S3) {
        $migrationProbe = Join-Path $PSScriptRoot 'migration-files-smoke.cjs'
        $migrationTools = Join-Path $root 'backend\tools'
        Invoke-Docker (@('run', '--rm', '--network', $network, '--entrypoint', 'node') + $storageEnv + @(
            '-e', 'DATABASE_URL', '-e', 'FILE_STORAGE=s3', '-e', 'NODE_ENV=test',
            '--mount', "type=bind,source=$migrationTools,target=/build/tools,readonly",
            '--mount', "type=bind,source=$migrationProbe,target=/build/migration-files-smoke.cjs,readonly",
            $buildImage, 'migration-files-smoke.cjs'))
    }

    $apiStorageEnv = @()
    if ($S3) { $apiStorageEnv = $storageEnv + @('-e', 'FILE_STORAGE=s3', '-e', 'NODE_ENV=test') }
    Invoke-Docker (@('run', '-d', '--name', $api, '--network', $network, '--user', '10001:10001') + $apiStorageEnv + @(
        '-e', 'DATABASE_URL', '-e', 'JWT_ACCESS_SECRET', '-e', 'JWT_REFRESH_SECRET',
        '-e', 'BCRYPT_ROUNDS=10', '-e', 'COOKIE_SECURE=true', '-e', 'COOKIE_SAMESITE=strict',
        '-e', 'CORS_ORIGINS=https://app.example.test', $Image))
    $verifyStorageEnv = @()
    if ($S3) { $verifyStorageEnv = $storageEnv + @('-e', 'SMOKE_S3=true') }
    Invoke-Docker (@('run', '--rm', '--network', $network, '--entrypoint', 'node') + $verifyStorageEnv + @(
        '-e', 'DATABASE_URL', '-e', 'SMOKE_PASSWORD', '-e', "SMOKE_LAMBDA_URL=http://${api}:8080",
        '--mount', "type=bind,source=$probePath,target=/build/lambda-image-smoke.cjs,readonly",
        $buildImage, 'lambda-image-smoke.cjs', 'verify'))
} finally {
    foreach ($container in @($api, $migrator, $database, $storage)) {
        $existing = & $DockerPath container ls -a --filter "name=^/$container$" --format '{{.Names}}'
        if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo consultar la limpieza de $container"; continue }
        if ($existing -eq $container) {
            & $DockerPath rm -f -v $container | Out-Host
            if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo limpiar $container" }
        }
    }
    if ($networkCreated) {
        & $DockerPath network rm $network | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo limpiar $network" }
    }
    foreach ($temporaryImage in @($buildImage, $temporaryMigrationImage)) {
        $existingImage = & $DockerPath image ls --format '{{.Repository}}:{{.Tag}}' $temporaryImage
        if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo consultar la limpieza de $temporaryImage" }
        if ($existingImage -eq $temporaryImage) {
            & $DockerPath image rm $temporaryImage | Out-Host
            if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo limpiar $temporaryImage" }
        }
    }
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
