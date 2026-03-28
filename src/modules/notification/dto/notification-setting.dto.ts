import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  meditation_reminders?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  new_content_alerts?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  community_updates?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  notification_reminder?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  email_updates?: boolean;
}
