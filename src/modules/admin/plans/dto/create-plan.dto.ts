// dto/create-plan.dto.ts
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsNumber()
  @Min(1)
  price_in_cents: number; // e.g. 999 for $9.99

  @IsOptional()
  @IsString()
  currency?: string; // default: 'usd'

  @IsOptional()
  @IsIn(['month', 'year', 'one_time'])
  interval?: 'month' | 'year' | 'one_time'; // default: 'month'
}
