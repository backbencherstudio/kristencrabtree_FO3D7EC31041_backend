import { Injectable } from '@nestjs/common';
import { Role } from 'src/common/guard/role/role.enum';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { UserRepository } from 'src/common/repository/user/user.repository';
import appConfig from 'src/config/app.config';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/notification-setting.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    const settings = await this.prisma.notificationSettings.upsert({
      where: { user_id: userId },
      update: {},
      create: {
        user_id: userId,
        // all default to true — matches the UI toggles
        meditation_reminders: true,
        new_content_alerts: true,
        community_updates: true,
        notification_reminder: true,
        email_updates: true,
      },
    });
    return { success: true, data: settings };
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const settings = await this.prisma.notificationSettings.upsert({
      where: { user_id: userId },
      update: { ...dto },
      create: {
        user_id: userId,
        meditation_reminders: dto.meditation_reminders ?? true,
        new_content_alerts: dto.new_content_alerts ?? true,
        community_updates: dto.community_updates ?? true,
        notification_reminder: dto.notification_reminder ?? true,
        email_updates: dto.email_updates ?? true,
      },
    });
    return { success: true, data: settings };
  }

  async findAll(user_id: string) {
    try {
      const where_condition = {};
      const userDetails = await UserRepository.getUserDetails(user_id);

      if (userDetails.type == Role.ADMIN) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      }

      const notifications = await this.prisma.notification.findMany({
        where: {
          ...where_condition,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          created_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
      });

      if (notifications.length > 0) {
        for (const notification of notifications) {
          if (notification.sender && notification.sender.avatar) {
            notification.sender['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar + notification.sender.avatar,
            );
          }
        }
      }

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id: string) {
    try {
      // check if notification exists
      const notification = await this.prisma.notification.findUnique({
        where: {
          id: id,
          // receiver_id: user_id,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(user_id: string) {
    try {
      // check if notification exists
      const notifications = await this.prisma.notification.findMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      if (notifications.length == 0) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.deleteMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
