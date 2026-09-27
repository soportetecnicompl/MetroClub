import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  segment?: Record<string, unknown>;
}
