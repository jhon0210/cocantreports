import { spawn } from 'node:child_process';
import type { Handler } from 'aws-lambda';
import { loadCloudSecrets } from './infrastructure/config/cloud-secrets';

export const handler: Handler<{ operation: string }, { ok: true; elapsedMs: number }> = async (event, context) => {
  if (event.operation !== 'schema-deploy') throw new Error('Operacion de migracion no permitida');
  await loadCloudSecrets(true);
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Falta la conexion del ejecutor de migraciones');
  const started = Date.now();
  const timeout = Math.min(780_000, context.getRemainingTimeInMillis() - 15_000);
  if (timeout <= 0) throw new Error('Tiempo insuficiente para migrar');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
      stdio: 'ignore',
      timeout,
      killSignal: 'SIGKILL',
    });
    child.once('error', () => reject(new Error('No se pudo iniciar el ejecutor Prisma')));
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('La migracion fallo o excedio su tiempo; revisar el estado Prisma antes de reintentar')));
  });
  return { ok: true, elapsedMs: Date.now() - started };
};
