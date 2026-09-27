import { IsIn, IsOptional, IsString } from 'class-validator';
import type { ClientSegment } from '../../reports/reports.service';

const SEGMENTS: ClientSegment[] = ['active', 'at_risk', 'dormant', 'lost', 'never'];

export class SendSegmentCampaignDto {
  @IsIn(SEGMENTS)
  segment!: ClientSegment;

  /** Nombre de una plantilla activa en whatsapp_templates (p. ej. "win_back"). */
  @IsString()
  templateName!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
