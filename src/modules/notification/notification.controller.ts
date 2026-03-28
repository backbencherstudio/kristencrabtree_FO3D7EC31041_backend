import { Controller, Get, Param, Delete, UseGuards, Req, Patch, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateNotificationSettingsDto } from './dto/notification-setting.dto';

@ApiBearerAuth()
@ApiTags('Notification')
@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@Req() req: any) {
    return this.notificationService.getSettings(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('settings')
  async updateSettings(
    @Req() req: any,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationService.updateSettings(req.user.userId, dto);
  }

  @ApiOperation({ summary: 'Get all notifications' })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const notification = await this.notificationService.findAll(user_id);

      return notification;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete notification' })
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      const user_id = req.user.userId;
      const notification = await this.notificationService.remove(id, user_id);
      return notification;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete all notifications' })
  @Delete()
  async removeAll(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      const notification = await this.notificationService.removeAll(user_id);

      return notification;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
