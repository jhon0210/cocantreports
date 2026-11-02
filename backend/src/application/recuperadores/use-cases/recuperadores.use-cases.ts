import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { validarCaracterizacion } from '../../../domain/recuperadores/caracterizacion';
import { EstadoRecuperadorId } from '../../../domain/recuperadores/estado-recuperador.entity';
import {
  ESTADO_RECUPERADOR_REPOSITORY,
  EstadoRecuperadorRepository,
} from '../../../domain/recuperadores/estado-recuperador.repository';
import { CambiosRecuperador } from '../../../domain/recuperadores/recuperador.entity';
import { RECUPERADOR_REPOSITORY, RecuperadorRepository } from '../../../domain/recuperadores/recuperador.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { CLOCK, Clock } from '../../ports/clock.port';
import {
  CEDULA_REGEX,
  CreateRecuperadorDto,
  EstadoRecuperadorDto,
  RecuperadorResponseDto,
  UpdateRecuperadorDto,
} from '../dto/recuperador.dto';
import { RecuperadorMapper } from '../mappers/recuperador.mapper';
import { prepararDocumentos } from '../documentos-recuperador';

function validarFotoStorage(dto: UpdateRecuperadorDto, propietarioId?: number) {
  if (dto.foto_archivo_id !== undefined && (!dto.foto_archivo_id || !propietarioId || dto.foto !== undefined)) {
    throw new ValidationError('Referencia de foto S3 invalida');
  }
  if (process.env.FILE_STORAGE === 's3' && dto.foto !== undefined) {
    throw new ValidationError('Adjunta la foto mediante la carga directa S3');
  }
}

function documentosEntrada(
  dtos: NonNullable<UpdateRecuperadorDto['documentos']>,
  actuales: Parameters<typeof prepararDocumentos>[1],
  propietarioId?: number,
) {
  if (process.env.FILE_STORAGE === 's3' && dtos.some((doc) => doc.contenido !== undefined)) {
    throw new ValidationError('Adjunta los documentos mediante la carga directa S3');
  }
  return prepararDocumentos(dtos, actuales, propietarioId);
}

@Injectable()
export class ListRecuperadoresUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(): Promise<RecuperadorResponseDto[]> {
    return (await this.recuperadores.list()).map(RecuperadorMapper.toDto);
  }
}

@Injectable()
export class ListEstadosRecuperadorUseCase {
  constructor(@Inject(ESTADO_RECUPERADOR_REPOSITORY) private readonly estados: EstadoRecuperadorRepository) {}

  async execute(): Promise<EstadoRecuperadorDto[]> {
    return (await this.estados.list()).map((e) => ({ id_estado: e.id, nombre: e.nombre }));
  }
}

@Injectable()
export class GetRecuperadorUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(id: number): Promise<RecuperadorResponseDto> {
    const recuperador = await this.recuperadores.findById(id);
    if (!recuperador) throw new NotFoundError(`No existe el recuperador ${id}`);
    return RecuperadorMapper.toDto(recuperador);
  }
}

@Injectable()
export class CreateRecuperadorUseCase {
  constructor(
    @Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository,
    @Inject(ESTADO_RECUPERADOR_REPOSITORY) private readonly estados: EstadoRecuperadorRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(dto: CreateRecuperadorDto, propietarioId?: number): Promise<RecuperadorResponseDto> {
    validarFotoStorage(dto, propietarioId);
    const idEstado = dto.id_estado ?? EstadoRecuperadorId.ACTIVO;
    if (!(await this.estados.findById(idEstado))) throw new NotFoundError(`No existe el estado ${idEstado}`);
    if (await this.recuperadores.findByCedula(dto.cedula)) {
      throw new ConflictError(`Ya existe un recuperador con la cédula ${dto.cedula}`);
    }
    const codigoRegistro = await this.generarCodigoRegistro();
    const caracterizacion = dto.caracterizacion ? validarCaracterizacion(dto.caracterizacion, this.clock.today(), true) : null;
    const creado = await this.recuperadores.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      cedula: dto.cedula,
      idEstado,
      bancarizado: dto.bancarizado,
      foto: dto.foto ?? null,
      fotoArchivo: dto.foto_archivo_id && propietarioId ? { id: dto.foto_archivo_id, propietarioId } : undefined,
      codigoRegistro,
      caracterizacion,
      documentos: dto.documentos ? documentosEntrada(dto.documentos, [], propietarioId) : undefined,
    });
    return RecuperadorMapper.toDto(creado);
  }

  /** Número aleatorio de 8 dígitos, único entre los recuperadores existentes. */
  private async generarCodigoRegistro(): Promise<string> {
    for (let intento = 0; intento < 10; intento++) {
      const codigo = String(randomInt(10_000_000, 100_000_000));
      if (!(await this.recuperadores.findByCodigoRegistro(codigo))) return codigo;
    }
    throw new ConflictError('No se pudo generar un código de registro único. Intenta de nuevo');
  }
}

@Injectable()
export class UpdateRecuperadorUseCase {
  constructor(
    @Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository,
    @Inject(ESTADO_RECUPERADOR_REPOSITORY) private readonly estados: EstadoRecuperadorRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(id: number, dto: UpdateRecuperadorDto, propietarioId?: number): Promise<RecuperadorResponseDto> {
    validarFotoStorage(dto, propietarioId);
    const actual = await this.recuperadores.findById(id);
    if (!actual) throw new NotFoundError(`No existe el recuperador ${id}`);

    const cambios: CambiosRecuperador = {};
    if (dto.documentos !== undefined) cambios.documentos = documentosEntrada(dto.documentos, actual.documentos ?? [], propietarioId);
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.apellido !== undefined) cambios.apellido = dto.apellido;
    if (dto.bancarizado !== undefined) cambios.bancarizado = dto.bancarizado;
    if (dto.foto !== undefined) cambios.foto = dto.foto;
    if (dto.foto_archivo_id && propietarioId) cambios.fotoArchivo = { id: dto.foto_archivo_id, propietarioId };
    if (dto.caracterizacion !== undefined) {
      cambios.caracterizacion = validarCaracterizacion(dto.caracterizacion, this.clock.today(), false);
    }

    if (dto.cedula !== undefined && dto.cedula !== actual.cedula) {
      const otro = await this.recuperadores.findByCedula(dto.cedula);
      if (otro && otro.id !== id) throw new ConflictError(`Ya existe un recuperador con la cédula ${dto.cedula}`);
      cambios.cedula = dto.cedula;
    }
    if (dto.id_estado !== undefined && dto.id_estado !== actual.idEstado) {
      if (!(await this.estados.findById(dto.id_estado))) throw new NotFoundError(`No existe el estado ${dto.id_estado}`);
      cambios.idEstado = dto.id_estado;
    }

    if (Object.keys(cambios).length === 0) return RecuperadorMapper.toDto(actual);
    return RecuperadorMapper.toDto(await this.recuperadores.update(id, cambios));
  }
}

@Injectable()
export class GetDocumentoRecuperadorUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(id: number, documentoId: number) {
    const documento = await this.recuperadores.findDocumento(id, documentoId);
    if (!documento) throw new NotFoundError('No existe el documento en este recuperador');
    return documento;
  }
}

/** Eliminación física solo si el recuperador no tiene ventas; si las tiene, se debe cambiar su estado. */
@Injectable()
export class DeleteRecuperadorUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(id: number): Promise<void> {
    if (!(await this.recuperadores.findById(id))) throw new NotFoundError(`No existe el recuperador ${id}`);
    if (await this.recuperadores.hasReportes(id)) {
      throw new ConflictError('El recuperador tiene ventas registradas y no se puede eliminar. Cambia su estado a Inactivo.');
    }
    await this.recuperadores.delete(id);
  }
}

/** Caso de uso único para buscar por cédula; lo reutilizan /recuperadores/cedula y /usuarios/cedula. */
@Injectable()
export class GetRecuperadorByCedulaUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(cedula: string): Promise<RecuperadorResponseDto> {
    const limpia = cedula.trim();
    if (!CEDULA_REGEX.test(limpia)) throw new ValidationError('La cédula debe contener solo dígitos (5 a 15)');
    const recuperador = await this.recuperadores.findByCedula(limpia);
    if (!recuperador) throw new NotFoundError(`No se encontró un recuperador con la cédula ${limpia}`);
    return RecuperadorMapper.toDto(recuperador);
  }
}

/** Busca por el código único de registro que lleva el código de barras del carnet. */
@Injectable()
export class GetRecuperadorByCodigoUseCase {
  constructor(@Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository) {}

  async execute(codigo: string): Promise<RecuperadorResponseDto> {
    const limpio = codigo.trim();
    if (!/^[A-Za-z0-9._/-]{1,40}$/.test(limpio)) throw new ValidationError('El código de barras no es válido');
    const recuperador = await this.recuperadores.findByCodigoRegistro(limpio);
    if (!recuperador) throw new NotFoundError(`No se encontró un recuperador con el código ${limpio}`);
    return RecuperadorMapper.toDto(recuperador);
  }
}
