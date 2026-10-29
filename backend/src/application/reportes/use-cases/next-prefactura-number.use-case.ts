import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class NextPrefacturaNumberUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<number> {
    const [{ numero }] = await this.prisma.$queryRaw<Array<{ numero: number }>>`SELECT nextval('prefactura_numero_seq')::int AS numero`;
    return numero;
  }
}
