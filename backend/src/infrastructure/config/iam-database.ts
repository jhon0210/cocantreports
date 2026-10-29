import { Signer } from '@aws-sdk/rds-signer';
import { PrismaPg } from '@prisma/adapter-pg';

export function iamDatabase() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const region = process.env.AWS_REGION;
  if (!host || !/^[a-z0-9.-]+\.rds\.amazonaws\.com$/.test(host) ||
      !user || !/^[a-z][a-z0-9_]*$/.test(user) ||
      !database || !/^[a-z][a-z0-9_]*$/.test(database) || !region) {
    throw new Error('Configuracion IAM de PostgreSQL invalida');
  }
  const signer = new Signer({ hostname: host, port: 5432, username: user, region });
  const url = new URL(`postgresql://${user}@${host}:5432/${database}`);
  return { host, user, database, signer, url };
}

export function iamAdapter(databaseName?: string): PrismaPg {
  const { host, user, database, signer } = iamDatabase();
  return new PrismaPg({
    host, user, database: databaseName ?? database, port: 5432,
    // pg pide un token nuevo por cada conexion, tambien en Lambdas calientes.
    password: () => signer.getAuthToken(),
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 600,
  }, {
    onPoolError: () => console.error('Conexion IAM PostgreSQL inactiva interrumpida'),
    onConnectionError: () => console.error('Conexion IAM PostgreSQL interrumpida'),
  });
}

export async function iamMigrationUrl(): Promise<string> {
  const { url, signer } = iamDatabase();
  url.password = encodeURIComponent(await signer.getAuthToken());
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('sslaccept', 'strict');
  url.searchParams.set('sslcert', '/var/task/gateway-root-bundle.pem');
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('pool_timeout', '5');
  return url.toString();
}
