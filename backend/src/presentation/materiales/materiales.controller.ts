import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MaterialDto } from '../../application/materiales/dto/material.dto';
import { GetMaterialUseCase, ListMaterialesUseCase } from '../../application/materiales/use-cases/materiales.use-cases';

@ApiTags('materiales')
@ApiBearerAuth('access-token')
@Controller('materiales')
export class MaterialesController {
  constructor(
    private readonly listMateriales: ListMaterialesUseCase,
    private readonly getMaterial: GetMaterialUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: [MaterialDto] })
  list(): Promise<MaterialDto[]> {
    return this.listMateriales.execute();
  }

  @Get(':id')
  @ApiOkResponse({ type: MaterialDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<MaterialDto> {
    return this.getMaterial.execute(id);
  }
}
