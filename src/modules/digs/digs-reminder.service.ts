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

  // ── Daily Dig + Journal reminder — every 1 minute (TESTING) ───────────
  @Cron('* * * * *')
  async sendDigAndJournalReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: {
        type: 'user',
        fcm_token: { not: null },
        OR: [
          { notificationSettings: { is: null } },
          { notificationSettings: { is: { notification_reminder: true } } },
        ],
      },
      include: { notificationSettings: true },
    });

    for (const user of users) {
      // ── Dig reminder ────────────────────────────────────────────────
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

      // ── Journal reminder ─────────────────────────────────────────────
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

    console.log('✅ Dig + Journal reminders sent at', new Date().toISOString());
  }

  // ── Meditation reminder — every 1 minute (TESTING) ─────────────────────
  @Cron('* * * * *')
  async sendMeditationReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: {
        type: 'user',
        fcm_token: { not: null },
        OR: [
          { notificationSettings: { is: null } },
          { notificationSettings: { is: { meditation_reminders: true } } },
        ],
      },
      include: { notificationSettings: true },
    });

    for (const user of users) {
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

  // ── New content alert — every 1 minute (TESTING) ───────────────────────
  @Cron('* * * * *')
  async sendNewContentAlerts() {
    const users = await this.prisma.user.findMany({
      where: {
        type: 'user',
        fcm_token: { not: null },
        OR: [
          { notificationSettings: { is: null } },
          { notificationSettings: { is: { new_content_alerts: true } } },
        ],
      },
      include: { notificationSettings: true },
    });

    for (const user of users) {
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
