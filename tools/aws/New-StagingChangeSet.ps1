param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('bootstrap', 'foundation', 'foundation-express', 'application')]
    [string]$Stage,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9]{12}$')]
    [string]$AccountId,
    [Parameter(Mandatory = $true)]
    [ValidateSet('CREATE', 'UPDATE')]
    [string]$ChangeSetType,
    [string]$ParametersFile,
    [string]$Profile = 'cocjant-staging',
    [string]$AwsPath = 'aws'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$template = Join-Path $root "infra\cloudformation\$Stage.yml"
$stack = "cocjant-staging-$Stage"
if ($Stage -eq 'foundation-express') { $stack = 'cocjant-staging-foundation-recovery' }
$change = "review-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"

function Invoke-Aws {
    param([string[]]$Arguments)
    & $AwsPath @Arguments --profile $Profile --region us-east-1 --no-cli-pager
    if ($LASTEXITCODE -ne 0) { throw "AWS fallo: $($Arguments[0]) $($Arguments[1]); no se ejecutaron recursos." }
}

$identity = Invoke-Aws @('sts', 'get-caller-identity', '--output', 'json') | ConvertFrom-Json
if ($identity.Account -ne $AccountId -or $identity.Arn -match ':root$') {
    throw 'Cuenta incorrecta o sesion root: revision detenida.'
}
Invoke-Aws @('cloudformation', 'validate-template', '--template-body', "file://$template")
$parameters = @()
if ($ParametersFile) {
    $resolved = (Resolve-Path $ParametersFile).Path
    $parameters = @(Get-Content -Raw $resolved | ConvertFrom-Json)
    foreach ($parameter in $parameters) {
        if ($parameter.ParameterKey -match '(?i)password|token|credential|secretstring|databaseurl|jwt') {
            throw 'No incluir valores de secretos en parametros CloudFormation.'
        }
    }
}
if ($Stage -eq 'application' -and $ChangeSetType -eq 'UPDATE') {
    $alias = Invoke-Aws @('lambda', 'get-alias', '--function-name', 'cocjant-staging-api', '--name', 'live', '--output', 'json') | ConvertFrom-Json
    $api = Invoke-Aws @('lambda', 'get-function', '--function-name', 'cocjant-staging-api', '--output', 'json') | ConvertFrom-Json
    $migration = Invoke-Aws @('lambda', 'get-function', '--function-name', 'cocjant-staging-migrate', '--output', 'json') | ConvertFrom-Json
    $cleanup = Invoke-Aws @('lambda', 'get-function', '--function-name', 'cocjant-staging-cleanup', '--output', 'json') | ConvertFrom-Json
    if ($api.Code.ResolvedImageUri -ne $cleanup.Code.ResolvedImageUri) {
        throw 'API/limpieza tienen imagenes distintas; reconciliar despliegue antes de cambiar infraestructura.'
    }
    $expected = @{
        LiveVersion = $alias.FunctionVersion
        ApiImageDigest = ($api.Code.ResolvedImageUri -split '@')[-1]
        MigrationImageDigest = ($migration.Code.ResolvedImageUri -split '@')[-1]
    }
    foreach ($key in $expected.Keys) {
        $supplied = @($parameters | Where-Object { $_.ParameterKey -eq $key })
        if ($supplied.Count -ne 1 -or $supplied[0].UsePreviousValue -or $supplied[0].ParameterValue -ne $expected[$key]) {
            throw "UPDATE requiere $key explicito e igual al valor AWS actual; no revertir codigo/alias con CloudFormation."
        }
    }
}
$arguments = @('cloudformation', 'create-change-set', '--stack-name', $stack,
    '--change-set-name', $change, '--change-set-type', $ChangeSetType, '--template-body', "file://$template",
    '--capabilities', 'CAPABILITY_NAMED_IAM', '--tags', 'Key=Project,Value=cocjant', 'Key=Environment,Value=staging',
    '--description', 'Revision solamente; ejecutar requiere aprobacion separada del cambio y costos.')
if ($ParametersFile) {
    $arguments += @('--parameters', "file://$resolved")
}
Invoke-Aws $arguments
Invoke-Aws @('cloudformation', 'wait', 'change-set-create-complete', '--stack-name', $stack, '--change-set-name', $change)
Invoke-Aws @('cloudformation', 'describe-change-set', '--stack-name', $stack, '--change-set-name', $change,
    '--query', '{Status:Status,ExecutionStatus:ExecutionStatus,Changes:Changes}')
Write-Host "Change set listo para revisar: $stack / $change. NO ejecutado."
