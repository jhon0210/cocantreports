import { ApiProperty } from '@nestjs/swagger';
import { UsuarioResponseDto } from '../../usuarios/dto/usuario-response.dto';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT de corta duración; enviar como Authorization: Bearer <token>' })
  access_token: string;

  @ApiProperty({ example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Segundos de vigencia del access token', example: 900 })
  expires_in: number;

  @ApiProperty({ type: UsuarioResponseDto })
  user: UsuarioResponseDto;
}
