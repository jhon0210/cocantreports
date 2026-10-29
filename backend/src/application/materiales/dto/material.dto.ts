import { ApiProperty } from '@nestjs/swagger';

export class MaterialDto {
  @ApiProperty() id_mat: number;
  @ApiProperty({ nullable: true, type: Number }) codigo: number | null;
  @ApiProperty({ nullable: true, type: String }) nomMaterial: string | null;
}
