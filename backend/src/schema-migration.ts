import { spawn } from 'node:child_process';
import type { Handler } from 'aws-lambda';
import { loadCloudSecrets } from './infrastructure/config/cloud-secrets';
import { iamMigrationUrl } from './infrastructure/config/iam-database';

export const handler: Handler<{ operation: string }, { ok: true; elapsedMs: number }> = async (event, context) => {
  if (event.operation !== 'schema-deploy') throw new Error('Operacion de migracion no permitida');
  await loadCloudSecrets(true);
  if (process.env.DB_AUTH_MODE === 'iam') process.env.MIGRATION_DATABASE_URL = await iamMigrationUrl();
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Falta la conexion del ejecutor de migraciones');
  const started = Date.now();
  const timeout = Math.min(780_000, context.getRemainingTimeInMillis() - 15_000);
  if (timeout <= 0) throw new Error('Tiempo insuficiente para migrar');
  await new Promise<void>((resolve, reject) => {
    let diagnostic = '';
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      killSignal: 'SIGKILL',
    });
    const collect = (data: Buffer) => { diagnostic = (diagnostic + data.toString('utf8')).slice(-16_384); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', () => reject(new Error('No se pudo iniciar el ejecutor Prisma')));
    child.once('exit', (code) => {
      if (code === 0) { resolve(); return; }
      const prismaCode = diagnostic.match(/\bP[0-9]{4}\b/)?.[0] ?? 'sin codigo Prisma';
      reject(new Error(`La migracion fallo (${prismaCode}, exit ${code}); revisar el estado Prisma antes de reintentar`));
    });
  });
  return { ok: true, elapsedMs: Date.now() - started };
};
