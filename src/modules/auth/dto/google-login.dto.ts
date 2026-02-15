import { IsOptional, IsString } from "class-validator";

export class GoogleLoginDto {
  @IsString()
  token: string;
}