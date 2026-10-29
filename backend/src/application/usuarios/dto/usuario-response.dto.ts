import { ApiProperty } from '@nestjs/swagger';

export class UsuarioResponseDto {
  @ApiProperty() id_user: number;
  @ApiProperty() nomUser: string;
  @ApiProperty() apeUser: string;
  @ApiProperty() usuario: string;
  @ApiProperty({ nullable: true, type: Number }) cedula: number | null;
  @ApiProperty({ nullable: true, type: Number }) id_perfil: number | null;
  @ApiProperty({ nullable: true, type: String, example: 'Operario' }) perfil: string | null;
  @ApiProperty({ nullable: true, type: Number }) id_cargo: number | null;
  @ApiProperty({ nullable: true, type: String }) cargo: string | null;
  @ApiProperty({ nullable: true, type: Number }) id_eca: number | null;
  @ApiProperty({ nullable: true, type: String, description: 'Nombre de la ECA asociada (perfil Administrador Eca)' }) eca: string | null;
  @ApiProperty() activo: boolean;
}
