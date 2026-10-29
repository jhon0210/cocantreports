import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'operario1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  usuario: string;

  @ApiProperty({ example: 'Operario123*' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  clave: string;
}
