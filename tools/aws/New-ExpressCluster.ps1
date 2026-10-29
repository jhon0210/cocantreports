param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9]{12}$')][string]$AccountId,
    [string]$AwsPath = 'aws',
    [string]$Profile = 'cocjant-staging'
)
$ErrorActionPreference = 'Stop'
function Invoke-Aws {
    param([string[]]$Arguments)
    $result = & $AwsPath @Arguments --profile $Profile --region us-east-1 --output json --no-cli-pager
    if ($LASTEXITCODE -ne 0) { throw "AWS fallo: $($Arguments[0]) $($Arguments[1])" }
    return ($result | ConvertFrom-Json)
}
$identity = Invoke-Aws @('sts', 'get-caller-identity')
if ($identity.Account -ne $AccountId -or $identity.Arn -match ':root$') { throw 'Cuenta no autorizada o sesion root' }
$plan = Invoke-Aws @('freetier', 'get-account-plan-state')
if ($plan.accountPlanType -ne 'FREE' -or $plan.accountPlanStatus -ne 'ACTIVE') { throw 'Este procedimiento requiere Free plan activo' }
$clusters = Invoke-Aws @('rds', 'describe-db-clusters')
$existing = @($clusters.DBClusters | Where-Object { $_.DBClusterIdentifier -eq 'cocjant-staging-express' })
if ($existing.Count -eq 0) {
    $null = Invoke-Aws @('rds', 'create-db-cluster', '--db-cluster-identifier', 'cocjant-staging-express',
        '--engine', 'aurora-postgresql', '--with-express-configuration',
        '--backup-retention-period', '1', '--deletion-protection', '--copy-tags-to-snapshot',
        '--serverless-v2-scaling-configuration', 'MinCapacity=0.5,MaxCapacity=1',
        '--tags', 'Key=Environment,Value=staging', 'Key=Project,Value=cocjant')
}
& $AwsPath rds wait db-cluster-available --db-cluster-identifier cocjant-staging-express --profile $Profile --region us-east-1 --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'Aurora Express aun no disponible; revisar antes de reintentar' }
$result = Invoke-Aws @('rds', 'describe-db-clusters', '--db-cluster-identifier', 'cocjant-staging-express')
$cluster = $result.DBClusters[0]
if (-not $cluster.InternetAccessGatewayEnabled -or -not $cluster.IAMDatabaseAuthenticationEnabled -or
    -not $cluster.DeletionProtection -or $cluster.BackupRetentionPeriod -ne 1 -or
    $cluster.ServerlessV2ScalingConfiguration.MinCapacity -ne 0.5 -or
    $cluster.ServerlessV2ScalingConfiguration.MaxCapacity -ne 1) {
    throw 'La configuracion existente no coincide; no se modifica automaticamente'
}
$cluster | Select-Object DBClusterIdentifier, Status, Endpoint, DbClusterResourceId, EngineVersion,
    InternetAccessGatewayEnabled, IAMDatabaseAuthenticationEnabled, DeletionProtection, BackupRetentionPeriod,
    ServerlessV2ScalingConfiguration
