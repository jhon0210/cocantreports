import type { Handler } from 'aws-lambda';
import { ArchivosService } from './application/archivos/archivos.service';
import { loadCloudSecrets } from './infrastructure/config/cloud-secrets';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaArchivoRepository } from './infrastructure/storage/prisma-archivo.repository';
import { S3ObjectStorage } from './infrastructure/storage/s3-object-storage';

export const handler: Handler<{ operation: string }, { eliminados: number; limite: number }> = async (event) => {
  if (event.operation !== 'cleanup-files') throw new Error('Operacion de limpieza no permitida');
  await loadCloudSecrets();
  const prisma = new PrismaService();
  try {
    const archivos = new ArchivosService(new S3ObjectStorage(), new PrismaArchivoRepository(prisma));
    return await archivos.cleanup();
  } finally { await prisma.$disconnect(); }
};
