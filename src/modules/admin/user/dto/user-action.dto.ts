import { Transform } from 'class-transformer';
import { IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class userActionDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @ApiProperty({
    description: 'User status (number)',
    example: 1,
    type: Number,
  })
  status?: number;
}
