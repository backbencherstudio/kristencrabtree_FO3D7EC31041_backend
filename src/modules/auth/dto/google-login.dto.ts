import { IsOptional, IsString } from "class-validator";

export class GoogleLoginDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  fcm_token?: string;
}