import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import appConfig from '../../config/app.config';
import { SubscriptionManager } from '../../common/helper/subscription.manager';

function getWeekBoundaries(date: Date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);

  const weekStart = new Date(current.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// ── Layer name → human readable ──────────────────────────────────────────────
const LAYER_LABELS = {
  The_Question: 'The Question',
  The_Journal: 'Explore',
  The_Experience: 'The Experience',
  The_Reflection: 'Reflect',
};

// ── Transition message per layer ─────────────────────────────────────────────
const LAYER_TRANSITIONS = {
  1: 'Noticing this is where change begins. Continue to Layer 2',
  2: 'Noticing this is where change begins. Continue to Layer 3',
  3: 'Noticing this is where change begins. Continue to Layer 4',
  4: 'Dig Complete — Another layer of awareness unlocked.',
};

@Injectable()
export class DigsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Format dig for response ───────────────────────────────────────────────
  private formatDig(dig: any, userResponses: any[] = []) {
    const layers = (dig.layers || [])
      .sort((a: any, b: any) => (a.layer_number || 0) - (b.layer_number || 0))
      .map((layer: any, index: number) => {
        const layerNum = layer.layer_number || index + 1;
        const response = userResponses.find((r) => r.layer_id === layer.id);
        return {
          ...layer,
          layer_number: layerNum,
          layer_label: LAYER_LABELS[layer.question_name] || layer.question_name,
          layer_position: `Layer ${layerNum} of 4`,
          transition_message: LAYER_TRANSITIONS[layerNum],
          is_answered: !!response,
          user_response: response?.response || null,
        };
      });

    return {
      ...dig,
      layers,
      dig_path: 'The Question → Explore → The Experience → Reflect',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET SINGLE DIG WITH USER PROGRESS
  // ═══════════════════════════════════════════════════════════════════════
  async getDigWithProgress(userId: string, digId: string) {
    try {
      const dig = await this.prisma.digs.findUnique({
        where: { id: digId },
        include: {
          layers: { orderBy: { layer_number: 'asc' } },
        },
      });

      if (!dig) return { success: false, message: 'Dig not found' };

      // Get user's responses for this dig
      const responses = await this.prisma.digResponse.findMany({
        where: { dig_id: digId, user_id: userId },
      });

      // Get user's current progress (which layer they paused on)
      const progress = await this.prisma.userDigProgress.findUnique({
        where: { user_id_dig_id: { user_id: userId, dig_id: digId } },
      });

      const formattedDig = this.formatDig(dig, responses);

      return {
        success: true,
        data: {
          ...formattedDig,
          current_layer: progress?.current_layer || 1,
          completed: progress?.completed || false,
          started: !!progress,
          // Onboarding message (shown on first dig start)
          onboarding: {
            message:
              "Each Dig has four layers. You don't complete this app, you explore it.",
            xp_info: 'XP reflects your engagement — not your progress.',
          },
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // START A DIG (creates progress record)
  // ═══════════════════════════════════════════════════════════════════════
  async startDig(userId: string, digId: string) {
    try {
      const dig = await this.prisma.digs.findUnique({
        where: { id: digId },
        include: { layers: { orderBy: { layer_number: 'asc' } } },
      });

      if (!dig) return { success: false, message: 'Dig not found' };

      // Create or get existing progress (supports resume)
      const progress = await this.prisma.userDigProgress.upsert({
        where: { user_id_dig_id: { user_id: userId, dig_id: digId } },
        update: { last_active_at: new Date() },
        create: {
          user_id: userId,
          dig_id: digId,
          current_layer: 1,
          started_at: new Date(),
          last_active_at: new Date(),
        },
      });

      const responses = await this.prisma.digResponse.findMany({
        where: { dig_id: digId, user_id: userId },
      });

      const formattedDig = this.formatDig(dig, responses);

      const isResuming = responses.length > 0;

      return {
        success: true,
        message: isResuming
          ? `Resuming from Layer ${progress.current_layer}`
          : "Dig started. Each Dig has four layers. You don't complete this app, you explore it.",
        data: {
          ...formattedDig,
          current_layer: progress.current_layer,
          is_resuming: isResuming,
          completed: progress.completed,
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE LAYER RESPONSE (supports pause/resume)
  // ═══════════════════════════════════════════════════════════════════════
  async saveLayerResponse(
    userId: string,
    digId: string,
    layerId: string,
    response: string,
  ) {
    try {
      const dig = await this.prisma.digs.findUnique({
        where: { id: digId },
        include: { layers: { orderBy: { layer_number: 'asc' } } },
      });
      if (!dig) return { success: false, message: 'Dig not found' };

      const layer = await this.prisma.layers.findUnique({
        where: { id: layerId },
      });
      if (!layer) return { success: false, message: 'Layer not found' };

      // ── Save or update response ───────────────────────────────────────
      const saved = await this.prisma.digResponse.upsert({
        where: {
          user_id_dig_id_layer_id: {
            user_id: userId,
            dig_id: digId,
            layer_id: layerId,
          },
        },
        update: { response, updated_at: new Date() },
        create: { user_id: userId, dig_id: digId, layer_id: layerId, response },
      });

      // ── Update user's current layer progress ──────────────────────────
      const layerNumber = layer.layer_number || 1;
      const nextLayer = layerNumber + 1;
      const isLastLayer = layerNumber === 4;

      await this.prisma.userDigProgress.upsert({
        where: { user_id_dig_id: { user_id: userId, dig_id: digId } },
        update: {
          current_layer: isLastLayer ? 4 : nextLayer,
          last_active_at: new Date(),
          completed: isLastLayer,
          completed_at: isLastLayer ? new Date() : null,
        },
        create: {
          user_id: userId,
          dig_id: digId,
          current_layer: isLastLayer ? 4 : nextLayer,
          last_active_at: new Date(),
          completed: isLastLayer,
          completed_at: isLastLayer ? new Date() : null,
        },
      });

      // ── Award XP for engagement ───────────────────────────────────────
      let xpEarned = 0;
      if (layer.point) {
        xpEarned = layer.point;
        await this.prisma.user.update({
          where: { id: userId },
          data: { acheivedXp: { increment: xpEarned } },
        });
      }

      // ── Build response with transition message ────────────────────────
      const transitionMessage = LAYER_TRANSITIONS[layerNumber];
      const layerLabel =
        LAYER_LABELS[layer.question_name] || layer.question_name;

      return {
        success: true,
        message: isLastLayer
          ? 'Dig 1 Complete — Another layer of awareness unlocked. Keep digging to reveal your True Self.'
          : `You've completed ${layerLabel}`,
        data: {
          response: saved,
          layer_completed: layerNumber,
          next_layer: isLastLayer ? null : nextLayer,
          is_dig_complete: isLastLayer,
          transition_message: transitionMessage,
          xp:
            xpEarned > 0
              ? {
                  earned: xpEarned,
                  message: `You showed up — ${xpEarned} XP earned.`,
                  tooltip:
                    "XP reflects time spent engaging with your inner work — not how well you're doing.",
                }
              : null,
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET ALL RESPONSES FOR A DIG
  // ═══════════════════════════════════════════════════════════════════════
  async getDigResponses(userId: string, digId: string) {
    try {
      const responses = await this.prisma.digResponse.findMany({
        where: { user_id: userId, dig_id: digId },
        include: { layer: true },
        orderBy: { created_at: 'asc' },
      });

      // Get current progress
      const progress = await this.prisma.userDigProgress.findUnique({
        where: { user_id_dig_id: { user_id: userId, dig_id: digId } },
      });

      return {
        success: true,
        data: {
          responses: responses.map((r) => ({
            ...r,
            layer_label:
              LAYER_LABELS[r.layer?.question_name] || r.layer?.question_name,
            layer_position: `Layer ${r.layer?.layer_number} of 4`,
          })),
          current_layer: progress?.current_layer || 1,
          completed: progress?.completed || false,
          total_layers: 4,
          answered_layers: responses.length,
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET USER XP
  // ═══════════════════════════════════════════════════════════════════════
  async getUserXp(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { acheivedXp: true, currentLevel: true },
      });

      if (!user) return { success: false, message: 'User not found' };

      return {
        success: true,
        data: {
          xp: user.acheivedXp,
          level: user.currentLevel,
          // Client requirement: XP messaging
          microcopy: 'XP reflects your engagement — not your progress.',
          tooltip:
            "XP reflects time spent engaging with your inner work — not how well you're doing.",
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET RANDOM DIG (existing — no changes)
  // ═══════════════════════════════════════════════════════════════════════
  async getRandom(userId: string, search?: string) {
    try {
      const user = await this.prisma.user.findFirst({ where: { id: userId } });
      if (!user) return { success: false, message: 'User Not found' };

      if (search?.trim()) return await this.searchDigs(search.trim());

      const isProductionMode = appConfig().app.production_mode === 'true';
      if (!isProductionMode) return await this.generateRandomDig(userId);

      const userPlan = await SubscriptionManager(this.prisma, userId);
      if (!userPlan || !userPlan.success) {
        return {
          success: false,
          message: userPlan?.message ?? 'Subscription check failed.',
        };
      }

      if (!userPlan.focus_area || userPlan.focus_area.length === 0) {
        return { success: false, message: 'User has no saved preferences' };
      }

      const isFreeUser = userPlan.subscriptionName === 'free';
      const { weekStart, weekEnd } = getWeekBoundaries();

      if (isFreeUser) {
        return await this.handleFreeUserDigs(
          userId,
          userPlan,
          weekStart,
          weekEnd,
        );
      } else {
        return await this.handlePaidUserDigs(userId, userPlan);
      }
    } catch (error) {
      console.error('Error in getRandom:', error);
      return {
        success: false,
        message: 'Failed to fetch digs',
        error: (error as Error).message,
      };
    }
  }

  // ── All existing private methods stay exactly the same ────────────────────
  private async searchDigs(search: string) {
    const results = await this.prisma.digs.findMany({
      where: { OR: [{ title: { contains: search, mode: 'insensitive' } }] },
      include: { layers: { orderBy: { layer_number: 'asc' } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    return {
      success: true,
      data: { digs: results },
      count: results.length,
      query: search,
    };
  }

  private async handleFreeUserDigs(userId, userPlan, weekStart, weekEnd) {
    // ... exact same as your existing code
  }

  private async handlePaidUserDigs(userId, userPlan) {
    // ... exact same as your existing code
  }

  async markDigComplete(userId: string, digId: string) {
    // ... exact same as your existing code
  }

  async getDigProgress(userId: string) {
    // ... exact same as your existing code
  }

  private async generateRandomDig(userId: string) {
    // ... exact same as your existing code
  }
}
