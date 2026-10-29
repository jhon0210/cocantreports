import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { iamDatabase } from './iam-database';

export async function loadCloudSecrets(migration = false): Promise<void> {
  const arn = process.env.APP_SECRET_ARN;
  if (!arn) return;
  const client = new SecretsManagerClient({});
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
    if (!result.SecretString) throw new Error('El secreto de aplicacion no contiene JSON');
    const parsed: unknown = JSON.parse(result.SecretString);
    if (!parsed || typeof parsed !== 'object') throw new Error('Secreto de aplicacion invalido');
    const iam = process.env.DB_AUTH_MODE === 'iam';
    const fields = migration ? (iam ? [] : ['MIGRATION_DATABASE_URL'])
      : [...(iam ? [] : ['DATABASE_URL']), 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    const values: Record<string, string> = {};
    for (const key of fields) {
      if (!(key in parsed)) throw new Error(`Falta ${key} en el secreto`);
      const value: unknown = Reflect.get(parsed, key);
      if (typeof value !== 'string' || value.length === 0) throw new Error(`Secreto ${key} invalido`);
      values[key] = value;
    }
    if (!iam) {
      const url = new URL(values[migration ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL']);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.searchParams.get('sslmode') !== 'require' ||
        url.searchParams.get('sslaccept') !== 'strict' || url.searchParams.get('sslcert') !== '/var/task/rds-global-bundle.pem') {
        throw new Error('La conexion cloud requiere TLS estricto con la CA RDS');
      }
    } else if (!migration) {
      values.DATABASE_URL = iamDatabase().url.toString();
    }
    Object.assign(process.env, values);
  } catch {
    // Never propagate SDK/JSON errors that could include secret content.
    throw new Error('No se pudieron cargar o validar los secretos del entorno');
  } finally { client.destroy(); }
}
