import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  // @IsNotEmpty()
  // @ApiProperty()
  // name?: string;

  @IsNotEmpty()
  @ApiProperty()
  first_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  email?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;

  @IsBoolean()
  @ApiProperty()
  is_agrred_to_terms_and_policy: boolean;
}
