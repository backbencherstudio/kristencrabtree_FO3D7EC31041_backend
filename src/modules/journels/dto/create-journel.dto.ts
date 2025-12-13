import { IsString, IsOptional, IsArray, IsEnum } from "class-validator";
import { Transform } from "class-transformer";

export enum JournalType {
  Text = "Text",
  Audio = "Audio"
}

export class CreateJournelDto {
  @IsEnum(JournalType)
  type: JournalType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  audio?: string;

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  tags: string[];
}
