import { IsString } from 'class-validator';

export class SendClientCampaignDto {
  @IsString()
  clientId!: string;

  /** Nombre de una plantilla activa en whatsapp_templates (p. ej. "win_back"). */
  @IsString()
  templateName!: string;
}
