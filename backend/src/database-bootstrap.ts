import { randomBytes } from 'node:crypto';
import { GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { PrismaClient } from '@prisma/client';
import type { Handler } from 'aws-lambda';
import { iamAdapter } from './infrastructure/config/iam-database';

export const handler: Handler<{ operation: string }, { ok: true }> = async (event) => {
  if (event.operation !== 'bootstrap-express' || process.env.DB_AUTH_MODE !== 'iam' ||
      process.env.DB_USER !== 'postgres' || !process.env.APP_SECRET_ARN) {
    throw new Error('Inicializacion Express no autorizada');
  }
  const admin = new PrismaClient({ adapter: iamAdapter('postgres') });
  try {
    const tls = await admin.$queryRaw<{ ssl: boolean }[]>`SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
    if (tls[0]?.ssl !== true) throw new Error('La inicializacion requiere TLS');
    for (const role of ['cocjant_migrate', 'cocjant_api']) {
      const exists = await admin.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${role})`;
      if (!exists[0]?.exists) await admin.$executeRawUnsafe(`CREATE ROLE ${role} LOGIN`);
      await admin.$executeRawUnsafe(`GRANT rds_iam TO ${role}`);
    }
    await admin.$executeRawUnsafe('GRANT cocjant_migrate TO postgres');
    const exists = await admin.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='cocjant')`;
    if (!exists[0]?.exists) await admin.$executeRawUnsafe('CREATE DATABASE cocjant OWNER cocjant_migrate');
    await admin.$executeRawUnsafe('REVOKE ALL ON DATABASE cocjant FROM PUBLIC');
    await admin.$executeRawUnsafe('GRANT CONNECT ON DATABASE cocjant TO cocjant_api, cocjant_migrate');
  } finally { await admin.$disconnect(); }
  const database = new PrismaClient({ adapter: iamAdapter('cocjant') });
  try {
    await database.$executeRawUnsafe('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await database.$executeRawUnsafe('ALTER SCHEMA public OWNER TO cocjant_migrate');
    await database.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO cocjant_api');
    await database.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES FOR ROLE cocjant_migrate IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cocjant_api');
    await database.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES FOR ROLE cocjant_migrate IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cocjant_api');
  } finally { await database.$disconnect(); }
  const secrets = new SecretsManagerClient({});
  try {
    const current = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.APP_SECRET_ARN }));
    const value: unknown = JSON.parse(current.SecretString ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Secreto Express invalido');
    if (Object.keys(value).length === 0) {
      await secrets.send(new PutSecretValueCommand({
        SecretId: process.env.APP_SECRET_ARN,
        SecretString: JSON.stringify({
          JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
          JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
        }),
      }));
    } else if (typeof Reflect.get(value, 'JWT_ACCESS_SECRET') !== 'string' ||
               typeof Reflect.get(value, 'JWT_REFRESH_SECRET') !== 'string') {
      throw new Error('Secreto Express existente incompleto; no se sobrescribe');
    }
  } finally { secrets.destroy(); }
  return { ok: true };
};
