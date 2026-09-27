import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { EnrollClientDto } from './dto/enroll-client.dto';
import { RegisterVisitDto } from './dto/register-visit.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('lookup')
  lookup(@Query('whatsapp') whatsapp: string) {
    return this.clientsService.findByWhatsapp(whatsapp);
  }

  @Post('enroll')
  enroll(@Body() dto: EnrollClientDto) {
    return this.clientsService.enroll(dto);
  }

  @Post(':id/visits')
  registerVisit(@Param('id') id: string, @Body() dto: RegisterVisitDto) {
    return this.clientsService.registerVisit(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.clientsService.getHistory(id);
  }

  @Delete(':id')
  forget(@Param('id') id: string) {
    return this.clientsService.forget(id);
  }
}
