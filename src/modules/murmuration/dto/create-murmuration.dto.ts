import { MurmurationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMurmurationDto {
  @IsEnum(MurmurationType)
  type: MurmurationType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class CreateCommentDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  reply_to_comment_id?: string;
}

