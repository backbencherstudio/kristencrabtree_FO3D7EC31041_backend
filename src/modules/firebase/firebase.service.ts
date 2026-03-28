import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MultiNotificationResult,
  NotificationOptions,
  NotificationPayload,
  SingleNotificationResult,
} from './firebase.interface';

const DEFAULT_IMAGE = 'https://i.ibb.co/0RyBBrwd/memo-14.png';

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];

// ── Map notification type → user setting toggle ──────────────────────────────
// Add any new notification type here — it auto-maps to the correct toggle
type NotificationSettingKey =
  | 'meditation_reminders'
  | 'new_content_alerts'
  | 'community_updates'
  | 'notification_reminder';

const NOTIFICATION_TYPE_MAP: Record<string, NotificationSettingKey> = {
  // new_content_alerts
  journal_created: 'new_content_alerts',
  dig_unlocked: 'new_content_alerts',
  weekly_digs: 'new_content_alerts',
  new_quote: 'new_content_alerts',
  new_meditation: 'new_content_alerts',
  new_content_alerts: 'new_content_alerts', // ← add this

  // meditation_reminders
  meditation_reminder: 'meditation_reminders',
  meditation_complete: 'meditation_reminders',
  meditation_reminders: 'meditation_reminders', // ← add this

  // community_updates
  community_like: 'community_updates',
  community_comment: 'community_updates',
  murmuration_like: 'community_updates',
  murmuration_comment: 'community_updates',

  // notification_reminder
  subscription_created: 'notification_reminder',
  subscription_renewed: 'notification_reminder',
  dig_completed: 'notification_reminder',
  notification_reminder: 'notification_reminder', // ← add this
};

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Check user setting for this notification type ────────────────────────
  private async isAllowed(userId: string, type: string): Promise<boolean> {
    const settingKey = NOTIFICATION_TYPE_MAP[type];

    console.log(
      `🔍 isAllowed check — userId: ${userId}, type: ${type}, settingKey: ${settingKey}`,
    );

    // Type not in map — always allow
    if (!settingKey) {
      console.log(`⚠️ Type "${type}" not in map — skipping check, allowing`);
      return true;
    }

    const settings = await this.prisma.notificationSettings.findUnique({
      where: { user_id: userId },
      select: {
        meditation_reminders: true,
        new_content_alerts: true,
        community_updates: true,
        notification_reminder: true,
      },
    });

    console.log(`📋 Settings for user ${userId}:`, settings);

    // No settings record = all enabled by default
    if (!settings) {
      console.log(`⚠️ No settings record found for user ${userId} — allowing`);
      return true;
    }

    const result = settings[settingKey] === true;
    console.log(
      `✅ Setting "${settingKey}" = ${settings[settingKey]} → allowed: ${result}`,
    );
    return result;
  }

  // ── Build FCM message ────────────────────────────────────────────────────
  private buildMessage(
    token: string,
    payload: NotificationPayload,
  ): admin.messaging.Message {
    const image = payload.image || DEFAULT_IMAGE;
    const data = payload.data
      ? JSON.parse(JSON.stringify(payload.data))
      : undefined;

    return {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: image,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
          imageUrl: image,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: { sound: 'default', 'mutable-content': 1 },
          fcm_options: { image },
        },
      },
      data,
    };
  }

  // ── Save notification record to DB ───────────────────────────────────────
  private async saveNotification(
    payload: NotificationPayload,
    options: NotificationOptions,
  ) {
    try {
      // Upsert NotificationEvent by type
      const event = await this.prisma.notificationEvent.upsert({
        where: { id: options.type },
        update: {},
        create: {
          id: options.type,
          type: options.type,
          text: payload.title,
        },
      });

      // Create Notification record
      await this.prisma.notification.create({
        data: {
          sender_id: options.senderId ?? null,
          receiver_id: options.receiverId,
          notification_event_id: event.id,
          entity_id: options.entityId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`saveNotification failed: ${err.message}`);
    }
  }

  // ── Send to a single token ───────────────────────────────────────────────
  async sendToOne(
    token: string,
    payload: NotificationPayload,
    options?: NotificationOptions,
  ): Promise<SingleNotificationResult> {
    // Auto-check user notification settings before sending
    if (options?.receiverId && options?.type) {
      const allowed = await this.isAllowed(options.receiverId, options.type);
      if (!allowed) {
        this.logger.log(
          `Skipped [${options.type}] → user ${options.receiverId} disabled this notification`,
        );
        return {
          success: false,
          error: 'Notification disabled by user',
        };
      }
    }

    try {
      const messageId = await admin
        .messaging()
        .send(this.buildMessage(token, payload));

      // Save to DB only on successful push
      if (options) {
        await this.saveNotification(payload, options);
      }

      return { success: true, messageId };
    } catch (err) {
      const isInvalidToken = INVALID_TOKEN_CODES.includes(err.code);

      if (isInvalidToken) {
        // Clear stale token from DB — won't be used again
        await this.prisma.user.updateMany({
          where: { fcm_token: token },
          data: { fcm_token: null },
        });
        this.logger.warn(`Cleared invalid FCM token [code: ${err.code}]`);
        return { success: false, error: 'Invalid token — cleared' };
      }

      this.logger.error(`sendToOne failed: ${err.message} [code: ${err.code}]`);
      return { success: false, error: err.message };
    }
  }

  // ── Send to multiple tokens (parallel) ──────────────────────────────────
  // Each user is individually checked against their own settings
  async sendToMany(
    tokens: string[],
    payload: NotificationPayload,
    options?: Omit<NotificationOptions, 'receiverId'> & {
      receiverIds: string[];
    },
  ): Promise<MultiNotificationResult> {
    if (!tokens.length) {
      return {
        success: false,
        totalSent: 0,
        totalFailed: 0,
        results: [],
      };
    }

    const results = await Promise.allSettled(
      tokens.map((token, i) =>
        this.sendToOne(
          token,
          payload,
          options
            ? { ...options, receiverId: options.receiverIds[i] }
            : undefined,
        ),
      ),
    );

    const mapped = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { success: false, error: r.reason?.message },
    );

    const totalSent = mapped.filter((r) => r.success).length;
    const totalSkipped = mapped.filter((r) => (r as any).skipped).length;
    const totalFailed = mapped.length - totalSent - totalSkipped;

    this.logger.log(
      `Push: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`,
    );

    return {
      success: totalSent > 0,
      totalSent,
      totalFailed,
      results: mapped,
    };
  }
}
