import { Inject, Injectable } from '@nestjs/common';
import { CambiosEca } from '../../../domain/ecas/eca.entity';
import { ECA_REPOSITORY, EcaRepository } from '../../../domain/ecas/eca.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { CreateEcaDto, EcaResponseDto, UpdateEcaDto } from '../dto/eca.dto';
import { EcaMapper } from '../mappers/eca.mapper';
import { MAX_PDF_COUNT, prepararAdjuntos } from '../adjuntos-eca';

@Injectable()
export class ListEcasUseCase {
  constructor(@Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository) {}

  async execute(): Promise<EcaResponseDto[]> {
    return (await this.ecas.list()).map(EcaMapper.toDto);
  }
}

@Injectable()
export class CreateEcaUseCase {
  constructor(@Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository) {}

  async execute(dto: CreateEcaDto, propietarioId?: number): Promise<EcaResponseDto> {
    if ((dto.adjuntos?.length ?? 0) > MAX_PDF_COUNT) throw new ValidationError('Solo puedes adjuntar hasta 5 archivos PDF por ECA');
    if (dto.adjuntos?.some((a) => a.id !== undefined)) throw new ValidationError('Una ECA nueva no puede reutilizar adjuntos existentes');
    const eca = await this.ecas.create({
      nombre: dto.nomEca,
      direccion: dto.direccion,
      ruta: dto.ruta ?? null,
      macroruta: dto.macroruta ?? null,
      comuna: dto.comuna ?? null,
      estado: dto.estado ?? 'Activa',
      categoria: dto.categoria ?? null,
      representante: dto.representante ?? null,
      codigoNuec: dto.codigo_nuec ?? null,
      adjuntos: dto.adjuntos ? prepararAdjuntos(dto.adjuntos, [], propietarioId).map((a) => {
        if ('id' in a) throw new ValidationError('Una ECA nueva no puede reutilizar adjuntos');
        return a;
      }) : undefined,
    });
    return EcaMapper.toDto(eca);
  }
}

@Injectable()
export class UpdateEcaUseCase {
  constructor(@Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository) {}

  async execute(id: number, dto: UpdateEcaDto, propietarioId?: number): Promise<EcaResponseDto> {
    const actual = await this.ecas.findById(id);
    if (!actual) throw new NotFoundError(`No existe la ECA ${id}`);

    const cambios: CambiosEca = {};
    if (dto.nomEca !== undefined) cambios.nombre = dto.nomEca;
    if (dto.direccion !== undefined) cambios.direccion = dto.direccion;
    if (dto.ruta !== undefined) cambios.ruta = dto.ruta;
    if (dto.macroruta !== undefined) cambios.macroruta = dto.macroruta;
    if (dto.comuna !== undefined) cambios.comuna = dto.comuna;
    if (dto.estado !== undefined) cambios.estado = dto.estado;
    if (dto.categoria !== undefined) cambios.categoria = dto.categoria;
    if (dto.representante !== undefined) cambios.representante = dto.representante;
    if (dto.codigo_nuec !== undefined) cambios.codigoNuec = dto.codigo_nuec;
    if (dto.adjuntos !== undefined && dto.adjuntos !== null) cambios.adjuntos = prepararAdjuntos(dto.adjuntos, actual.adjuntos, propietarioId);

    return EcaMapper.toDto(await this.ecas.update(id, cambios));
  }

}

@Injectable()
export class GetEcaAdjuntoUseCase {
  constructor(@Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository) {}

  async execute(ecaId: number, adjuntoId: number) {
    const adjunto = await this.ecas.findAdjunto(ecaId, adjuntoId);
    if (!adjunto) throw new NotFoundError('No existe el adjunto en esta ECA');
    return adjunto;
  }
}

@Injectable()
export class DeleteEcaUseCase {
  constructor(@Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository) {}

  async execute(id: number): Promise<void> {
    if (!(await this.ecas.findById(id))) throw new NotFoundError(`No existe la ECA ${id}`);
    if (await this.ecas.hasRelations(id)) {
      throw new ConflictError('La ECA tiene reportes de ventas o balances vinculados y no se puede eliminar.');
    }
    await this.ecas.delete(id);
  }
}
