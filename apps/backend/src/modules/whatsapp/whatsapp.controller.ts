import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { WhatsAppMessageType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(WhatsAppMessageType)
  type!: WhatsAppMessageType;

  @IsString()
  body!: string;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsEnum(WhatsAppMessageType)
  type?: WhatsAppMessageType;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp/templates')
export class WhatsappController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.whatsAppTemplate.findMany();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  create(@Body() dto: CreateTemplateDto) {
    return this.prisma.whatsAppTemplate.create({
      data: { name: dto.name, type: dto.type, body: dto.body },
    });
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.prisma.whatsAppTemplate.update({ where: { id }, data: dto });
  }

  /** Baja lógica — una plantilla ya usada en mensajes encolados no se puede borrar físicamente. */
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  deactivate(@Param('id') id: string) {
    return this.prisma.whatsAppTemplate.update({ where: { id }, data: { isActive: false } });
  }
}
