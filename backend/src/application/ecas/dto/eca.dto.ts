import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Trim } from '../../../shared/transformers/trim';

export class EcaAdjuntoDto {
  @ApiPropertyOptional({ description: 'Carga S3 confirmada, propiedad del usuario autenticado' })
  @IsOptional()
  @IsUUID()
  archivo_id?: string;
  @ApiPropertyOptional({ description: 'ID de un adjunto de esta ECA que se conserva' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ description: 'PDF nuevo en base64, máximo 2 MB (sin prefijo data URL)' })
  @IsOptional()
  @IsString()
  @MaxLength(2_796_204)
  contenido?: string;
}

export class EcaAdjuntoResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() nombre: string;
  @ApiProperty() tamano: number;
}

export class EcaResponseDto {
  @ApiProperty() id_eca: number;
  @ApiProperty({ nullable: true, type: String }) nomEca: string | null;
  @ApiProperty({ nullable: true, type: String }) direccion: string | null;
  @ApiProperty({ nullable: true, type: String }) comuna: string | null;
  @ApiProperty({ nullable: true, type: String }) estado: string | null;
  @ApiProperty({ nullable: true, type: String }) categoria: string | null;
  @ApiProperty({ nullable: true, type: String }) ruta: string | null;
  @ApiProperty({ nullable: true, type: String }) macroruta: string | null;
  @ApiProperty({ nullable: true, type: String }) representante: string | null;
  @ApiProperty({ nullable: true, type: String }) codigo_nuec: string | null;
  @ApiProperty({ type: [EcaAdjuntoResponseDto] }) adjuntos: EcaAdjuntoResponseDto[];
}

export class CreateEcaDto {
  @ApiProperty({ example: 'ECA Centro Verde' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomEca: string;

  @ApiProperty({ example: 'Calle 10 # 5-20' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  direccion: string;

  @ApiPropertyOptional({ example: 'R-01', description: 'Campo histórico' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  ruta?: string;

  @ApiPropertyOptional({ example: 'Macroruta Centro', description: 'Campo histórico' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  macroruta?: string;

  @ApiPropertyOptional({ example: 'Comuna 10' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  comuna?: string;

  @ApiPropertyOptional({ example: 'Activa', description: 'Por defecto: Activa' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  estado?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  categoria?: string;

  @ApiPropertyOptional({ description: 'Representante legal o responsable' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(150)
  representante?: string;

  @ApiPropertyOptional({ description: 'Código NUEC / Registro SUI (si aplica)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  codigo_nuec?: string;

  @ApiPropertyOptional({ type: [EcaAdjuntoDto], description: 'Máximo 5 PDF de 2 MB. Al editar, la lista reemplaza los adjuntos; omitirla los conserva.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EcaAdjuntoDto)
  adjuntos?: EcaAdjuntoDto[];
}

export class UpdateEcaDto extends PartialType(CreateEcaDto) {}
