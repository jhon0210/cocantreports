import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Trim } from '../../shared/transformers/trim';

const Peso = () => applyDecorators(ApiProperty({ minimum: 0, maximum: 1_000_000_000 }), IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 }), Min(0), Max(1_000_000_000));

export class ConsultaBalanceDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_eca?: number;
}

export class GuardarBalanceDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  id_eca: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  id_mat: number;

  @Peso() inventario_inicial_kg: number;
  @Peso() salidas_kg: number;
  @Peso() rechazos_kg: number;
  @Peso() entradas_esperadas_kg: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Peso()
  entradas_cat_kg?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  soporte_salidas?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  receptor_rechazos?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  observaciones?: string | null;

  @ApiProperty({ nullable: true, description: 'Null al crear; version recibida al editar' })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  version: number | null;

  @ApiProperty({ description: 'Confirma cantidades medidas y soportadas; cero no significa dato desconocido' })
  @Equals(true, { message: 'Confirma que las cantidades están medidas y soportadas' })
  mediciones_confirmadas: boolean;
}
