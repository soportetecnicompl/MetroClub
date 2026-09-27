import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsString } from 'class-validator';
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
}
