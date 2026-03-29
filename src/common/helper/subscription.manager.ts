import { PrismaClient } from '@prisma/client';

// ── Return Types ──────────────────────────────────────────────
export interface SubscriptionError {
  success: false;
  message: string;
}

export interface SubscriptionData {
  success: true;
  subscriptionName: string;
  journal_entries: number;
  quotesPerday: number;
  digsPerWeek: number;
  murmurationPostLimit: boolean;
  audioPostJournal: boolean;
  meditationAccess: boolean;
  adService: boolean;
  focus_area?: any;
  [key: string]: any;
}

export type SubscriptionResult = SubscriptionError | SubscriptionData;

export async function SubscriptionManager(
  prisma: PrismaClient,
  userId: string,
): Promise<SubscriptionResult> {
  const userSubscription = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { accessId: true },
  });

  if (!userSubscription) {
    return {
      success: false,
      message: 'No subscription found for this user.',
    };
  }

  if (!userSubscription.accessId) {
    return {
      success: false,
      message:
        'Your subscription is not properly configured. Please contact support.',
    };
  }

  const allowedPermission = await prisma.accessForSubscription.findUnique({
    where: {
      id: userSubscription.accessId,
    },
    select: {
      subscriptionName: true,
      journal_entries: true,
      quotesPerday: true,
      digsPerWeek: true,
      murmurationLimit: true,
      audioPostJournal: true,
      meditationAccess: true,
      adService: true,
    },
  });

  if (!allowedPermission) {
    return {
      success: false,
      message: 'Subscription plan details not found. Please contact support.',
    };
  }

  const userPreferences = await prisma.userPreferences.findFirst({
    where: { user_id: userId },
  });

  if (allowedPermission.subscriptionName !== 'free') {
    return {
      success: true,
      ...userPreferences,
      subscriptionName: allowedPermission.subscriptionName,
      journal_entries: Infinity,
      quotesPerday: Infinity,
      digsPerWeek: Infinity,
      murmurationPostLimit: allowedPermission.murmurationLimit,
      audioPostJournal: allowedPermission.murmurationLimit,
      meditationAccess: allowedPermission.meditationAccess,
      adService: allowedPermission.adService,
    };
  }

  return {
    success: true,
    ...userPreferences,
    ...allowedPermission,
    murmurationPostLimit: allowedPermission.murmurationLimit,
  };
}
