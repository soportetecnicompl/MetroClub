import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePromotionDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
