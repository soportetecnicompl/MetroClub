import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

class RecipeItemDto {
  @IsString()
  ingredientId!: string;

  @IsNumber()
  @Min(0.001)
  quantityPerUnit!: number;
}

export class SetRecipeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[];
}
