import { IsOptional, IsString } from 'class-validator';

export class RedeemRewardDto {
  @IsString()
  clientId!: string;

  @IsString()
  rewardId!: string;

  @IsOptional()
  @IsString()
  complexId?: string;
}
