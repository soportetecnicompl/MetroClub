import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { SalesChannel } from '@prisma/client';

class SaleItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SellConcessionsDto {
  @IsString()
  complexId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsEnum(SalesChannel)
  channel!: SalesChannel;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}
