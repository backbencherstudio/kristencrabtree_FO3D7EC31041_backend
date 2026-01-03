import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested, IsArray } from "class-validator";
import { Type as LayerType } from "@prisma/client";
import { Type } from "class-transformer";

export class CreateDigDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLayerDto)
  layers: CreateLayerDto[];
}

export class CreateLayerDto {
  @IsString()
  @IsOptional()
  question_name?: string;

  @IsEnum(LayerType)
  @IsOptional()
  question_type?: LayerType;

  @IsInt()
  @Min(0)
  @IsOptional()
  point?: number;

  @IsString()
  @IsOptional()
  question?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsBoolean()
  @IsOptional()
  other?: boolean;

  @IsString()
  @IsOptional()
  other_text?: string;

  @IsString()
  @IsOptional()
  text?: string;
}



export class SaveResponseItemDto {
  @IsString()
  layer_id: string;

  @IsArray()
  responses: any[];
}
export class SaveResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveResponseItemDto)
  answers: SaveResponseItemDto[];
}
