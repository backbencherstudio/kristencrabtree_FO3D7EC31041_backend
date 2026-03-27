import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class DigsReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ── Daily Dig + Journal reminder — 9 AM ────────────────────────────────
  @Cron('* * * * *')
  async sendDigAndJournalReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: { type: 'user', fcm_token: { not: null } },
      include: { notificationSettings: true },
    });

    for (const user of users) {
      const settings = user.notificationSettings;

      // ── Dig reminder (notification_reminder toggle) ──────────────────
      if (!settings || settings.notification_reminder) {
        const todayDig = await this.prisma.userDailyDig.findFirst({
          where: {
            userId: user.id,
            assignedAt: { gte: today },
          },
        });

        if (!todayDig) {
          await this.firebaseService.sendToOne(
            user.fcm_token,
            {
              title: 'Time to Dig! 🌱',
              body: "Don't forget your daily Dig! Take a moment for yourself today.",
              data: { screen: 'DigsScreen' },
            },
            {
              receiverId: user.id,
              type: 'notification_reminder',
              entityId: user.id,
            },
          );
        }
      }

      // ── Journal reminder (notification_reminder toggle) ──────────────
      if (!settings || settings.notification_reminder) {
        const todayJournal = await this.prisma.journel.findFirst({
          where: {
            user_id: user.id,
            created_at: { gte: today },
          },
        });

        if (!todayJournal) {
          await this.firebaseService.sendToOne(
            user.fcm_token,
            {
              title: 'Time to Journal ✍️',
              body: "Don't forget to write your journal today. Take a moment to reflect.",
              data: { screen: 'JournalScreen' },
            },
            {
              receiverId: user.id,
              type: 'notification_reminder',
              entityId: user.id,
            },
          );
        }
      }
    }

    console.log('✅ Dig + Journal reminders sent at', new Date().toISOString());
  }

  // ── Meditation reminder — 8 AM (meditation_reminders toggle) ───────────
  @Cron('* * * * *')
  async sendMeditationReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: { type: 'user', fcm_token: { not: null } },
      include: { notificationSettings: true },
    });

    for (const user of users) {
      const settings = user.notificationSettings;

      // Skip if user disabled meditation_reminders
      if (settings && !settings.meditation_reminders) continue;

      const listenedToday = await this.prisma.meditationListener.findFirst({
        where: { userId: user.id },
      });

      if (!listenedToday) {
        await this.firebaseService.sendToOne(
          user.fcm_token,
          {
            title: 'Time to Meditate 🧘',
            body: 'Take a few minutes for your daily meditation session.',
            data: { screen: 'MeditationScreen' },
          },
          {
            receiverId: user.id,
            type: 'meditation_reminder',
            entityId: user.id,
          },
        );
      }
    }
    console.log('✅ Meditation reminders sent at', new Date().toISOString());
  }

  // ── New content alert — every Monday 10 AM (new_content_alerts toggle) ─
  @Cron('* * * * *')
  async sendNewContentAlerts() {
    const users = await this.prisma.user.findMany({
      where: { type: 'user', fcm_token: { not: null } },
      include: { notificationSettings: true },
    });

    for (const user of users) {
      const settings = user.notificationSettings;

      // Skip if user disabled new_content_alerts
      if (settings && !settings.new_content_alerts) continue;

      await this.firebaseService.sendToOne(
        user.fcm_token,
        {
          title: 'New Content Available 🎉',
          body: 'New quotes, digs and meditations are waiting for you!',
          data: { screen: 'HomeScreen' },
        },
        {
          receiverId: user.id,
          type: 'new_content_alerts',
          entityId: user.id,
        },
      );
    }
    console.log('✅ New content alerts sent at', new Date().toISOString());
  }
}
