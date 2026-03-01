import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { SubscriptionManager } from 'src/common/helper/subscription.manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

// Helper function to get week boundaries
function getWeekBoundaries(date: Date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Monday as start

  const weekStart = new Date(current.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// In your service class
@Injectable()
export class DigsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getRandom(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User Not found',
        };
      }
      const isProductionMode = process.env.PRODUCTION_MODE === 'true';

      if (!isProductionMode) {
        // ✅ Development mode - generate random dig immediately
        return await this.generateRandomDig(userId);
      }
      const userPlan = await SubscriptionManager(this.prisma, userId);

      if (userPlan.focus_area.length === 0) {
        return {
          success: false,
          message: 'User has no saved preferences',
        };
      }

      const isFreeUser = userPlan.subscriptionName === 'free';
      const { weekStart, weekEnd } = getWeekBoundaries();

      if (isFreeUser) {
        // FREE USER: 3 digs per week
        return await this.handleFreeUserDigs(
          userId,
          userPlan,
          weekStart,
          weekEnd,
        );
      } else {
        // PAID USER: Sequential 2 digs per day (must complete previous to unlock next)
        return await this.handlePaidUserDigs(userId, userPlan);
      }
    } catch (err) {
      console.error('Error in getRandom:', err);
      return {
        success: false,
        message: 'Failed to fetch digs',
        error: err.message,
      };
    }
  }

  private async handleFreeUserDigs(
    userId: string,
    userPlan: any,
    weekStart: Date,
    weekEnd: Date,
  ) {
    // Check cache first
    const cacheKey = `digs:weekly:${userId}:${weekStart.getTime()}`;
    const cachedDigs = await this.redis.get(cacheKey);

    if (cachedDigs) {
      const parsed = JSON.parse(cachedDigs);
      return {
        success: true,
        message: 'Digs fetched successfully',
        data: parsed,
      };
    }

    // Check if user has weekly digs assigned
    const weeklyDigs = await this.prisma.userWeeklyDig.findMany({
      where: {
        userId,
        weekStart,
      },
      include: {
        dig: {
          include: {
            layers: true,
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Check if all 3 digs are completed
    const allCompleted =
      weeklyDigs.length === 3 && weeklyDigs.every((d) => d.completed);

    if (allCompleted) {
      const responseData = {
        digs: weeklyDigs.map((wd) => wd.dig),
        allCompleted: true,
        nextWeekStart: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      };

      return {
        success: true,
        message:
          'All weekly digs completed. New digs will be available next week.',
        data: responseData,
      };
    }

    // If we have existing digs for this week, return them
    if (weeklyDigs.length > 0) {
      const digsData = {
        digs: weeklyDigs.map((wd) => ({
          ...wd.dig,
          completed: wd.completed,
          position: wd.position,
        })),
        allCompleted: false,
        completedCount: weeklyDigs.filter((d) => d.completed).length,
      };

      // Cache until end of week
      const secondsUntilWeekEnd = Math.floor(
        (weekEnd.getTime() - Date.now()) / 1000,
      );
      await this.redis.set(
        cacheKey,
        JSON.stringify(digsData),
        'EX',
        secondsUntilWeekEnd,
      );

      return {
        success: true,
        message: 'Weekly digs fetched successfully',
        data: digsData,
      };
    }

    // Generate new weekly digs (first time this week)
    const availableDigs = await this.prisma.digs.findMany({
      where: {
        type: {
          hasSome: userPlan.focus_area,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        layers: true,
      },
      take: 50, // Get a pool to randomize from
    });

    if (availableDigs.length < 3) {
      return {
        success: false,
        message: 'Not enough digs available matching your preferences',
      };
    }

    // Randomly select 3 digs
    const shuffled = availableDigs.sort(() => 0.5 - Math.random());
    const selectedDigs = shuffled.slice(0, 3);

    // Create UserWeeklyDig records
    await this.prisma.$transaction(
      selectedDigs.map((dig, index) =>
        this.prisma.userWeeklyDig.create({
          data: {
            userId,
            digId: dig.id,
            weekStart,
            position: index + 1,
            completed: false,
          },
        }),
      ),
    );

    const digsData = {
      digs: selectedDigs.map((dig, index) => ({
        ...dig,
        completed: false,
        position: index + 1,
      })),
      allCompleted: false,
      completedCount: 0,
    };

    // Cache until end of week
    const secondsUntilWeekEnd = Math.floor(
      (weekEnd.getTime() - Date.now()) / 1000,
    );
    await this.redis.set(
      cacheKey,
      JSON.stringify(digsData),
      'EX',
      secondsUntilWeekEnd,
    );

    return {
      success: true,
      message: 'New weekly digs generated',
      data: digsData,
    };
  }

  private async handlePaidUserDigs(userId: string, userPlan: any) {
    // Check if there are ANY incomplete digs from ANY previous day
    const incompleteDigs = await this.prisma.userDailyDig.findMany({
      where: {
        userId,
        completed: false,
      },
      include: {
        dig: {
          include: {
            layers: true,
          },
        },
      },
      orderBy: { assignedAt: 'asc' }, // Oldest first
    });

    // If there are incomplete digs, return them (block new digs)
    if (incompleteDigs.length > 0) {
      const responseData = {
        digs: incompleteDigs.map((ud) => ({
          ...ud.dig,
          completed: ud.completed,
          assignedAt: ud.assignedAt,
          dailyDigNumber: ud.dailyDigNumber,
        })),
        hasIncomplete: true,
        message: 'Please complete your pending digs before getting new ones',
      };

      return {
        success: true,
        message: 'You have incomplete digs. Please complete them first.',
        data: responseData,
      };
    }

    // No incomplete digs - check today's assignment
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDigs = await this.prisma.userDailyDig.findMany({
      where: {
        userId,
        assignedAt: {
          gte: today,
        },
      },
      include: {
        dig: {
          include: {
            layers: true,
          },
        },
      },
      orderBy: { dailyDigNumber: 'asc' },
    });

    // If user already has 2 digs today (both completed), can't get more
    if (todayDigs.length >= 2) {
      return {
        success: false,
        message: 'Daily dig limit reached. You can get more digs tomorrow.',
        data: {
          digs: todayDigs.map((ud) => ({
            ...ud.dig,
            completed: ud.completed,
            dailyDigNumber: ud.dailyDigNumber,
          })),
        },
      };
    }

    // Determine which dig number to assign (1st or 2nd)
    const nextDigNumber = todayDigs.length + 1;

    // Get a random dig
    const availableDigs = await this.prisma.digs.findMany({
      where: {
        type: {
          hasSome: userPlan.focus_area,
        },
        // Exclude digs already assigned to this user (avoid repeats)
        NOT: {
          dailyAssignments: {
            some: {
              userId,
            },
          },
        },
      },
      include: {
        layers: true,
      },
      take: 20,
    });

    if (availableDigs.length === 0) {
      return {
        success: false,
        message:
          'No new digs available. You may have completed all available digs.',
      };
    }

    // Randomly select 1 dig
    const randomIndex = Math.floor(Math.random() * availableDigs.length);
    const selectedDig = availableDigs[randomIndex];

    // Create UserDailyDig record
    const newDailyDig = await this.prisma.userDailyDig.create({
      data: {
        userId,
        digId: selectedDig.id,
        assignedAt: new Date(),
        dailyDigNumber: nextDigNumber,
        completed: false,
      },
      include: {
        dig: {
          include: {
            layers: true,
          },
        },
      },
    });

    const allToday = [...todayDigs, newDailyDig];

    const responseData = {
      digs: allToday.map((ud) => ({
        ...ud.dig,
        completed: ud.completed,
        assignedAt: ud.assignedAt,
        dailyDigNumber: ud.dailyDigNumber,
      })),
      currentDigNumber: nextDigNumber,
      totalToday: allToday.length,
    };

    return {
      success: true,
      message: `Dig ${nextDigNumber} of 2 assigned for today`,
      data: responseData,
    };
  }

  // Call this when user completes a dig
  async markDigComplete(userId: string, digId: string) {
    try {
      const userPlan = await SubscriptionManager(this.prisma, userId);
      const isFreeUser = userPlan.subscriptionName === 'free';

      if (isFreeUser) {
        // For free users, mark the weekly dig as completed
        const { weekStart } = getWeekBoundaries();

        const weeklyDig = await this.prisma.userWeeklyDig.findFirst({
          where: {
            userId,
            digId,
            weekStart,
          },
        });

        if (!weeklyDig) {
          return {
            success: false,
            message: 'Weekly dig not found',
          };
        }

        if (weeklyDig.completed) {
          return {
            success: false,
            message: 'Dig already completed',
          };
        }

        await this.prisma.userWeeklyDig.update({
          where: { id: weeklyDig.id },
          data: { completed: true },
        });

        // Invalidate cache
        await this.redis.del(`digs:weekly:${userId}:${weekStart.getTime()}`);

        return {
          success: true,
          message: 'Dig marked as completed',
        };
      } else {
        // For paid users, mark the daily dig as completed
        const dailyDig = await this.prisma.userDailyDig.findFirst({
          where: {
            userId,
            digId,
          },
          orderBy: { assignedAt: 'desc' }, // Get most recent
        });

        if (!dailyDig) {
          return {
            success: false,
            message: 'Daily dig not found',
          };
        }

        if (dailyDig.completed) {
          return {
            success: false,
            message: 'Dig already completed',
          };
        }

        await this.prisma.userDailyDig.update({
          where: { id: dailyDig.id },
          data: { completed: true },
        });

        return {
          success: true,
          message: 'Dig completed successfully. You can now get the next dig.',
        };
      }
    } catch (err) {
      console.error('Error marking dig complete:', err);
      return {
        success: false,
        message: 'Failed to mark dig as complete',
        error: err.message,
      };
    }
  }

  // Optional: Get user's dig progress/stats
  async getDigProgress(userId: string) {
    try {
      const userPlan = await SubscriptionManager(this.prisma, userId);
      const isFreeUser = userPlan.subscriptionName === 'free';

      if (isFreeUser) {
        const { weekStart } = getWeekBoundaries();

        const weeklyDigs = await this.prisma.userWeeklyDig.findMany({
          where: { userId, weekStart },
        });

        return {
          success: true,
          data: {
            type: 'free',
            totalThisWeek: weeklyDigs.length,
            completedThisWeek: weeklyDigs.filter((d) => d.completed).length,
            allCompleted:
              weeklyDigs.length === 3 && weeklyDigs.every((d) => d.completed),
          },
        };
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayDigs = await this.prisma.userDailyDig.findMany({
          where: {
            userId,
            assignedAt: { gte: today },
          },
        });

        const incompleteDigs = await this.prisma.userDailyDig.count({
          where: {
            userId,
            completed: false,
          },
        });

        return {
          success: true,
          data: {
            type: 'paid',
            totalToday: todayDigs.length,
            completedToday: todayDigs.filter((d) => d.completed).length,
            remainingToday: Math.max(0, 2 - todayDigs.length),
            hasIncomplete: incompleteDigs > 0,
            incompleteCount: incompleteDigs,
          },
        };
      }
    } catch (err) {
      console.error('Error getting dig progress:', err);
      return {
        success: false,
        message: 'Failed to get dig progress',
      };
    }
  }

  private async generateRandomDig(userId: string) {
    try {
      // Get total count
      const total = await this.prisma.digs.count();

      if (total === 0) {
        return {
          success: false,
          message: 'No digs available',
        };
      }

      // Get random dig
      const randomIndex = Math.floor(Math.random() * total);

      const dig = await this.prisma.digs.findFirst({
        skip: randomIndex,
        take: 1,
        include: {
          layers: true,
        },
      });

      if (!dig) {
        return {
          success: false,
          message: 'No dig found',
        };
      }

      return {
        success: true,
        message: 'Random dig fetched (Development Mode)',
        data: {
          digs: [dig],
          mode: 'development',
        },
      };
    } catch (error) {
      console.error('Error generating random dig:', error);
      return {
        success: false,
        message: 'Failed to generate random dig',
        error: error.message,
      };
    }
  }
}
