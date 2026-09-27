import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignStatus, Prisma } from '@prisma/client';
import { CreateCampaignDto } from './dto/create-campaign.dto';

/** RF-14: campañas de estrenos/eventos, envío masivo o segmentado. */
@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        segment: dto.segment as Prisma.InputJsonValue,
        status: dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
      },
    });
  }
}
