import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../../shared/transformers/trim';

export const CLAVE_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const CEDULA_USUARIO_MAX = 2_147_483_647;

export class CreateUsuarioDto {
  @ApiProperty({ example: 'Olga' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomUser: string;

  @ApiProperty({ example: 'Operaria' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apeUser: string;

  @ApiProperty({ example: 'operario2', description: '3-50 caracteres: letras, números, punto, guion y guion bajo' })
  @Trim()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, { message: 'usuario debe tener 3-50 caracteres (letras, números, ., _ o -)' })
  usuario: string;

  @ApiProperty({ example: 'Operario123*', description: 'Mínimo 8 caracteres con mayúscula, minúscula y número' })
  @IsString()
  @MinLength(8)
  @MaxLength(72, { message: 'clave no puede superar 72 caracteres' })
  @Matches(CLAVE_REGEX, { message: 'clave debe incluir mayúscula, minúscula y número' })
  clave: string;

  @ApiProperty({ example: 1000000010 })
  @IsInt()
  @Min(10000)
  @Max(CEDULA_USUARIO_MAX)
  cedula: number;

  @ApiProperty({ example: 3, description: 'id_perfil (ver GET /catalogos/roles)' })
  @IsInt()
  @Min(1)
  id_perfil: number;

  @ApiPropertyOptional({ example: 1, description: 'id_cargo (ver GET /catalogos/cargos)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_cargo?: number;

  @ApiPropertyOptional({ example: 1, description: 'ECA asociada; obligatoria para el perfil Administrador Eca y no admitida en los demás' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_eca?: number;
}

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
  @ApiPropertyOptional({ description: 'false desactiva la cuenta (baja lógica)' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
