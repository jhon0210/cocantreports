import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AFILIACIONES_SALUD,
  ESTADOS_CIVILES,
  ESTRATOS,
  GENEROS,
  GRUPOS_RH,
  JORNADAS,
  LUGARES_RECOLECCION,
  MATERIALES_RECUPERADOS,
  NIVELES_EDUCATIVOS,
  PERTENENCIAS_ETNICAS,
  TIPOS_DOCUMENTO,
  TRANSPORTES,
  USOS_EPP,
} from '../../../domain/recuperadores/caracterizacion';
import { Trim } from '../../../shared/transformers/trim';

export const CEDULA_REGEX = /^\d{5,15}$/;
export const CODIGO_REGISTRO_REGEX = /^[A-Za-z0-9._/-]{1,40}$/;
export const FOTO_REGEX = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
/** ~1,1 MB de imagen binaria en base64. La app comprime la foto antes de enviarla. */
export const FOTO_MAX_LENGTH = 1_500_000;

const Texto = (max: number) =>
  applyDecorators(ApiPropertyOptional({ maxLength: max }), IsOptional(), Trim(), IsString(), IsNotEmpty(), MaxLength(max));
const Opcion = (valores: readonly string[]) =>
  applyDecorators(ApiPropertyOptional({ enum: valores }), IsOptional(), IsIn(valores));
const Lista = (valores: readonly string[]) =>
  applyDecorators(ApiPropertyOptional({ enum: valores, isArray: true }), IsOptional(), IsArray(), ArrayUnique(), IsIn(valores, { each: true }));
const Booleano = () => applyDecorators(ApiPropertyOptional(), IsOptional(), IsBoolean());
const Fecha = () =>
  applyDecorators(ApiPropertyOptional({ example: '2026-10-14' }), IsOptional(), Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD' }));
const Entero = (max: number) => applyDecorators(ApiPropertyOptional({ minimum: 0, maximum: max }), IsOptional(), IsInt(), Min(0), Max(max));

/** Respuestas del formato de inscripción y caracterización; todas son opcionales y las reglas entre campos se validan en el dominio. */
export class CaracterizacionDto {
  @Fecha() fecha_inscripcion?: string;
  @Texto(150) lugar?: string;
  @Booleano() pertenece_organizacion?: boolean;
  @Texto(150) organizacion_nombre?: string;
  @Texto(30) organizacion_nit?: string;
  @Opcion(TIPOS_DOCUMENTO) tipo_documento?: string;
  @Texto(60) tipo_documento_otro?: string;
  @Fecha() fecha_nacimiento?: string;
  @Opcion(GENEROS) genero?: string;
  @Opcion(GRUPOS_RH) rh?: string;
  @Texto(200) direccion?: string;
  @Texto(150) barrio?: string;
  @Texto(150) comuna?: string;
  @Opcion(ESTRATOS) estrato?: string;
  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @Trim()
  @Matches(/^[0-9+()\s-]{7,20}$/, { message: 'telefono debe tener entre 7 y 20 caracteres numéricos' })
  telefono?: string;
  @Opcion(ESTADOS_CIVILES) estado_civil?: string;
  @Opcion(NIVELES_EDUCATIVOS) nivel_educativo?: string;
  @Opcion(PERTENENCIAS_ETNICAS) pertenencia_etnica?: string;
  @Booleano() discapacidad?: boolean;
  @Texto(150) discapacidad_tipo?: string;
  @Booleano() victima_conflicto?: boolean;
  @Booleano() ruv?: boolean;
  @Opcion(AFILIACIONES_SALUD) salud?: string;
  @Entero(99) dependientes_total?: number;
  @Entero(99) dependientes_menores?: number;
  @Entero(99) dependientes_adultos_mayores?: number;
  @Entero(99) dependientes_discapacidad?: number;
  @Entero(80) experiencia_anios?: number;
  @Opcion(JORNADAS) jornada?: string;
  @Opcion(LUGARES_RECOLECCION) lugar_recoleccion?: string;
  @Texto(150) microruta?: string;
  @Texto(200) microruta_direccion_inicial?: string;
  @Texto(200) microruta_direccion_final?: string;
  @Lista(TRANSPORTES) transporte?: string[];
  @Texto(150) transporte_otro?: string;
  @Texto(15) placa_habitual?: string;
  @Opcion(USOS_EPP) epp?: string;
  @Lista(MATERIALES_RECUPERADOS) materiales?: string[];
  @Texto(150) materiales_otros?: string;
  @Booleano() autoriza_datos?: boolean;
}

export class EstadoRecuperadorDto {
  @ApiProperty({ example: 1 }) id_estado: number;
  @ApiProperty({ example: 'Activo' }) nombre: string;
}

export class RecuperadorResponseDto {
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  documentos?: { id: number; tipo: string; nombre: string; mime: string; tamano: number }[];
  @ApiProperty() id_recuperador: number;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
  @ApiProperty({ example: '1090000001', description: 'Número de documento de identidad' }) cedula: string;
  @ApiProperty() bancarizado: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Data URL (JPEG/PNG). En el listado general se omite (null); usa tiene_foto.',
  })
  foto: string | null;
  @ApiProperty() tiene_foto: boolean;
  @ApiProperty({ nullable: true, type: String, example: 'REC-0001' }) codigo_registro: string | null;
  @ApiProperty({ nullable: true, type: CaracterizacionDto, description: 'Null en los recuperadores registrados antes del formato.' })
  caracterizacion: CaracterizacionDto | null;
  @ApiProperty({ example: '2026-10-14' }) FechaRegistro: string;
  @ApiProperty({ example: 1 }) id_estado: number;
  @ApiProperty({ example: 'Activo', description: 'Nombre del estado (Activo, Inactivo, Fallecido)' }) estado: string;
}

export class DocumentoRecuperadorDto {
  @ApiPropertyOptional({ description: 'Carga S3 confirmada del usuario autenticado' })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  archivo_id?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({ enum: ['identificacion', 'salud', 'servicios'] })
  @IsOptional()
  @IsIn(['identificacion', 'salud', 'servicios'])
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ description: 'Base64 sin prefijo; PDF, PNG o JPEG, hasta 1 MB' })
  @IsOptional()
  @IsString()
  @MaxLength(1_398_104)
  contenido?: string;
}

export class CreateRecuperadorDto {
  @ApiPropertyOptional({ description: 'Carga S3 de foto confirmada del usuario autenticado' })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  foto_archivo_id?: string;
  @ApiPropertyOptional({ type: () => [DocumentoRecuperadorDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => DocumentoRecuperadorDto)
  documentos?: DocumentoRecuperadorDto[];
  @ApiProperty({ example: 'Juan' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Pérez Gómez' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @ApiProperty({ example: '1090000010', description: 'Solo dígitos (5 a 15)' })
  @Trim()
  @IsString()
  @Matches(CEDULA_REGEX, { message: 'cedula debe contener solo dígitos (5 a 15)' })
  cedula: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  bancarizado: boolean;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Estado (ver GET /recuperadores/estados). Por defecto Activo.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_estado?: number;

  @ApiPropertyOptional({ description: 'Foto como data URL (image/jpeg o image/png en base64)' })
  @IsOptional()
  @IsString()
  @MaxLength(FOTO_MAX_LENGTH, { message: 'La foto es demasiado grande' })
  @Matches(FOTO_REGEX, { message: 'foto debe ser un data URL image/jpeg o image/png en base64' })
  foto?: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'REC-0001', description: 'Código único de registro. Null lo borra.' })
  @IsOptional()
  @Trim()
  @Matches(CODIGO_REGISTRO_REGEX, { message: 'codigo_registro admite letras, números, punto, guion, guion bajo y barra (máx. 40)' })
  codigo_registro?: string | null;

  @ApiPropertyOptional({
    type: CaracterizacionDto,
    description: 'Formato de inscripción y caracterización. En la actualización reemplaza el contenido completo.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CaracterizacionDto)
  caracterizacion?: CaracterizacionDto;
}

/** Actualización parcial: solo se modifican los campos enviados. Omitir `foto` conserva la actual. */
export class UpdateRecuperadorDto extends PartialType(CreateRecuperadorDto) {}
