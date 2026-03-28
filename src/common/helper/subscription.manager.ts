import { UserPreferences } from './../../../node_modules/.prisma/client/index.d';
import { PrismaClient } from '@prisma/client';

export async function SubscriptionManager(
  prisma: PrismaClient,
  userId: string,
) {
  const userSubscription = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { accessId: true },
  });

  if (!userSubscription) {
    return null;
  }

  let allowedPermission = await prisma.accessForSubscription.findUnique({
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

  const userPreferences=await prisma.userPreferences.findFirst({
    where:{
      user_id:userId
    }
  })

  if(allowedPermission.subscriptionName!=='free'){
    return{
      ...userPreferences,
      subscriptionName: allowedPermission.subscriptionName,
      journal_entries: Infinity,
      quotesPerday: Infinity,
      digsPerWeek: Infinity,
      murmurationPostLimit: allowedPermission.murmurationLimit,
      audioPostJournal:allowedPermission.murmurationLimit,
      meditationAccess: allowedPermission.meditationAccess,
      adService: allowedPermission.adService,
    }
  }
  const allowedPermissions={...userPreferences,...allowedPermission}
  return allowedPermissions;
}
