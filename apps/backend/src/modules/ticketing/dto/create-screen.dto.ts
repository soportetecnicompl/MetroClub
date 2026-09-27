import { IsString } from 'class-validator';

export class CreateScreenDto {
  @IsString()
  complexId!: string;

  @IsString()
  name!: string;
}
