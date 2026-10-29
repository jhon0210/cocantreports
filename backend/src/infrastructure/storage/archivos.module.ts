import { Global, Module } from '@nestjs/common';
import { ArchivosService } from '../../application/archivos/archivos.service';
import { OBJECT_STORAGE } from '../../application/ports/object-storage.port';
import { ARCHIVO_REPOSITORY } from '../../domain/archivos/archivo';
import { ArchivosController } from '../../presentation/archivos/archivos.controller';
import { PrismaArchivoRepository } from './prisma-archivo.repository';
import { S3ObjectStorage } from './s3-object-storage';

@Global()
@Module({
  providers: [
    ArchivosService, PrismaArchivoRepository,
    { provide: ARCHIVO_REPOSITORY, useExisting: PrismaArchivoRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorage },
  ],
  controllers: [ArchivosController],
  exports: [ArchivosService, PrismaArchivoRepository, OBJECT_STORAGE],
})
export class ArchivosModule {}
