import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ComplexesService } from './complexes.service';
import { CreateComplexDto } from './dto/create-complex.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('complexes')
export class ComplexesController {
  constructor(private readonly complexesService: ComplexesService) {}

  @Get()
  findAll() {
    return this.complexesService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  create(@Body() dto: CreateComplexDto) {
    return this.complexesService.create(dto);
  }
}
