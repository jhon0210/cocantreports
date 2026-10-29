import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsPositive, Matches, Max, Min, ValidateNested } from 'class-validator';
import { MAX_CANTIDAD_KG, MAX_VALOR_UNITARIO } from '../../../domain/reportes/reporte.entity';

export class UpdateReporteDto {
  @ApiPropertyOptional({ nullable: true, description: 'ECA del catálogo que identifica el código de macroruta y su nombre' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_eca_macroruta?: number | null;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  id_mat: number;

  @ApiProperty({ example: 12.5 })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_CANTIDAD_KG)
  cantidad: number;

  @ApiProperty({ example: 800 })
  @IsInt()
  @IsPositive()
  @Max(MAX_VALOR_UNITARIO)
  valor: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  id_eca: number;

  @ApiPropertyOptional({ example: '2026-10-14' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'FechaVenta debe tener formato YYYY-MM-DD' })
  FechaVenta?: string;
}

export class CreateReporteDto extends UpdateReporteDto {
  @ApiProperty({ example: 1, description: 'Recuperador que vende (ver GET /recuperadores/cedula/:cedula)' })
  @IsInt()
  @Min(1)
  id_recuperador: number;

}

export class CreateReportesBatchDto {
  @ApiProperty({ type: [CreateReporteDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReporteDto)
  registros: CreateReporteDto[];
}

export class ListReportesQueryDto {
  @ApiPropertyOptional({ description: 'Material de los reportes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_mat?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ventaDesde?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ventaHasta?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  registroDesde?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  registroHasta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{5,15}$/)
  cedula?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_eca?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

class ReporteMaterialDto {
  @ApiProperty({ nullable: true, type: Number }) codigo: number | null;
  @ApiProperty({ nullable: true, type: String }) nomMaterial: string | null;
}

class ReporteEcaDto {
  @ApiPropertyOptional({ nullable: true, type: String }) codigo_nuec?: string | null;
  @ApiProperty({ nullable: true, type: String }) nomEca: string | null;
  @ApiProperty({ nullable: true, type: String }) direccion: string | null;
  @ApiProperty({ nullable: true, type: String }) comuna: string | null;
}

class ReporteRecuperadorDto {
  @ApiPropertyOptional({ nullable: true, type: String }) tipo_documento?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Placa habitual actual del recuperador; no confirma el vehiculo historico del ingreso' }) placa_habitual?: string | null;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
  @ApiProperty() cedula: string;
}

class ReporteUsuarioDto {
  @ApiProperty({ nullable: true, type: String }) nomUser: string | null;
  @ApiProperty({ nullable: true, type: String }) apeUser: string | null;
  @ApiProperty({ nullable: true, type: String }) usuario: string | null;
}

export class ReporteResponseDto {
  @ApiPropertyOptional({ nullable: true, type: Number }) id_eca_macroruta?: number | null;
  @ApiPropertyOptional({ nullable: true }) macroruta?: { codigo: string | null; nombre: string | null } | null;
  @ApiProperty() consecutivo: number;
  @ApiProperty({ nullable: true, type: String }) comprobante: string | null;
  @ApiProperty({ description: 'Consecutivo automático desde 1, igual para todas las líneas de un comprobante' }) numero_reporte: number;
  @ApiProperty() id_mat: number;
  @ApiProperty({ type: ReporteMaterialDto }) material: ReporteMaterialDto;
  @ApiProperty({ description: 'Kilogramos' }) cantidad: number;
  @ApiProperty({ description: 'Valor unitario COP' }) valor: number;
  @ApiProperty({ description: 'cantidad * valor, redondeado a pesos' }) subtotal: number;
  @ApiProperty() id_user: number;
  @ApiProperty({ type: ReporteUsuarioDto }) usuario: ReporteUsuarioDto;
  @ApiProperty() id_eca: number;
  @ApiProperty({ type: ReporteEcaDto }) eca: ReporteEcaDto;
  @ApiProperty({ nullable: true, type: Number }) id_recuperador: number | null;
  @ApiProperty({ nullable: true, type: ReporteRecuperadorDto }) recuperador: ReporteRecuperadorDto | null;
  @ApiProperty({ example: '2026-10-14' }) FechaRegistro: string;
  @ApiProperty({ example: '2026-10-14' }) FechaVenta: string;
}
