import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ArchivoCarga, ArchivoRepository, ReferenciaArchivo, UsoArchivo } from '../../domain/archivos/archivo';
import { ConflictError, ForbiddenError } from '../../domain/shared/domain-errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaArchivoRepository implements ArchivoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(archivo: ArchivoCarga) {
    await this.prisma.archivoCarga.create({ data: archivo });
  }

  find(id: string) { return this.prisma.archivoCarga.findUnique({ where: { id } }); }

  async ready(id: string, propietarioId: number) {
    const result = await this.prisma.archivoCarga.updateMany({
      where: { id, propietarioId, estado: 'PENDIENTE', expiraEn: { gt: new Date() } },
      data: { estado: 'LISTO' },
    });
    return result.count === 1;
  }

  expired(limit: number) {
    return this.prisma.archivoCarga.findMany({
      where: { estado: { in: ['PENDIENTE', 'LISTO', 'ELIMINANDO'] }, expiraEn: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
      take: limit, orderBy: { expiraEn: 'asc' },
    });
  }

  async deleting(id: string) {
    const result = await this.prisma.archivoCarga.updateMany({
      where: { id, estado: { in: ['PENDIENTE', 'LISTO', 'ELIMINANDO'] }, expiraEn: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
      data: { estado: 'ELIMINANDO' },
    });
    return result.count === 1;
  }

  async remove(id: string) {
    await this.prisma.archivoCarga.deleteMany({ where: { id, estado: 'ELIMINANDO' } });
  }

  async tomar(tx: Prisma.TransactionClient, ref: ReferenciaArchivo, uso: UsoArchivo) {
    if (process.env.FILE_STORAGE !== 's3') throw new ConflictError('S3 no habilitado');
    const archivo = await tx.archivoCarga.findUnique({ where: { id: ref.id } });
    if (!archivo || archivo.propietarioId !== ref.propietarioId || archivo.uso !== uso) {
      throw new ForbiddenError('La referencia de archivo no pertenece al usuario o al tipo solicitado');
    }
    const claimed = await tx.archivoCarga.updateMany({
      where: { id: ref.id, estado: 'LISTO', expiraEn: { gt: new Date() } },
      data: { estado: 'VINCULADO' },
    });
    if (claimed.count !== 1) throw new ConflictError('El archivo ya fue utilizado o expiro; vuelve a adjuntarlo');
    return archivo;
  }

  async retirar(tx: Prisma.TransactionClient, usos: readonly UsoArchivo[], ids: number[]) {
    if (process.env.FILE_STORAGE !== 's3' || ids.length === 0) return;
    await tx.archivoCarga.updateMany({
      where: { uso: { in: [...usos] }, vinculoId: { in: ids }, estado: 'VINCULADO' },
      data: { estado: 'RETIRADO' },
    });
  }
}
