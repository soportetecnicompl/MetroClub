import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ComplexesService } from './complexes.service';
import { CreateComplexDto } from './dto/create-complex.dto';
import { UpdateComplexDto } from './dto/update-complex.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('complexes')
export class ComplexesController {
  constructor(private readonly complexesService: ComplexesService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.complexesService.findAll(includeInactive === 'true');
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  create(@Body() dto: CreateComplexDto) {
    return this.complexesService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateComplexDto) {
    return this.complexesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  deactivate(@Param('id') id: string) {
    return this.complexesService.deactivate(id);
  }
}
