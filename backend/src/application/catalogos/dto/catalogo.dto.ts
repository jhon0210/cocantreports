import { ApiProperty } from '@nestjs/swagger';

export class RolDto {
  @ApiProperty() id_perfil: number;
  @ApiProperty() perfil: string;
}

export class CargoDto {
  @ApiProperty() id_cargo: number;
  @ApiProperty() cargo: string;
  @ApiProperty({ nullable: true, type: String }) estado: string | null;
}
