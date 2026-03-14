import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDigDto, SaveResponseItemDto } from './dto/create-dig.dto';
import { UpdateDigDto } from './dto/update-dig.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { validate } from 'class-validator';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { SubscriptionManager } from 'src/common/helper/subscription.manager';
import { getLastNDaysRange } from '../dashboard/helper.utils';
import { getLevelFromTotalXp } from 'src/modules/auth/helper';

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
@Injectable()
export class DigsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(userid: string, createDigDto: CreateDigDto) {
    try {
      const errors = await validate(createDigDto);
      if (errors.length > 0) {
        throw new BadRequestException('Validation failed');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userid, type: 'admin' },
      });

      if (!user) {
        return {
          success: false,
          message: 'Only admin can create this',
        };
      }

      console.log(createDigDto.type)

      const createdDig = await this.prisma.digs.create({
        data: {
          title: createDigDto.title,
          type: { set: createDigDto.type ?? [] }, // ← default to [] if not sent
          user_id: userid,
          layers: {
            create: createDigDto.layers.map((layer) => ({
              question_name: layer.question_name,
              question_type: layer.question_type,
              point: layer.point,
              question: layer.question,
              options: layer.options ?? [],
              other: layer.other ?? false,
              other_text: layer.other_text,
              text: layer.text,
              user_id: userid, // ← also missing, Layers has user_id
            })),
          },
        },
        include: { layers: true },
      });

      return {
        success: true,
        data: createdDig,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creating dig',
        error: error.message,
      };
    }
  }

  async saveUserResponses(
    userId: string,
    digId: string,
    createdResponses: SaveResponseItemDto[],
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const dig = await this.prisma.digs.findUnique({
      where: { id: digId },
      include: {
        layers: {
          where: { deleted_at: null }, // ← only active layers, matches your schema
          select: { id: true },
        },
      },
    });
    if (!dig) return { success: false, message: 'Dig not found' };

    const totalLayers = dig.layers.length;
    if (totalLayers === 0) {
      return {
        success: false,
        message: 'This dig has no active layers configured.',
      };
    }

    const layerIds = createdResponses.map((r) => r.layer_id);

    const existingResponses = await this.prisma.digResponse.findMany({
      where: { dig_id: digId, user_id: userId },
      select: { layer_id: true },
    });
    const alreadyAnsweredLayerIds = existingResponses.map((r) => r.layer_id);
    const completedLayers = alreadyAnsweredLayerIds.length;

    if (completedLayers >= totalLayers) {
      return {
        success: false,
        message: 'You have already completed this dig.',
      };
    }

    // Block re-submitting already answered layers
    const duplicateLayers = layerIds.filter((id) =>
      alreadyAnsweredLayerIds.includes(id),
    );
    if (duplicateLayers.length > 0) {
      return {
        success: false,
        message: `You have already answered ${duplicateLayers.length} of these layer(s). Submit only unanswered layers.`,
      };
    }

    // Validate submitted layers belong to this dig and are active (deleted_at: null)
    const layers = await this.prisma.layers.findMany({
      where: {
        id: { in: layerIds },
        dig_id: digId,
        deleted_at: null, // ← matches your schema
      },
      select: {
        id: true,
        question_type: true,
        options: true,
        other: true,
        point: true,
      },
    });

    if (layers.length !== layerIds.length) {
      return {
        success: false,
        message:
          'One or more layers do not belong to this dig or have been deleted.',
      };
    }

    const layerMap = new Map(layers.map((l) => [l.id, l]));

    // Validate responses
    for (const response of createdResponses) {
      const layer = layerMap.get(response.layer_id);
      if (!layer)
        return {
          success: false,
          message: 'Layer does not belong to this dig.',
        };

      let options: string[] = [];
      if (Array.isArray(layer.options)) {
        options = layer.options as string[];
      } else if (typeof layer.options === 'string') {
        try {
          options = JSON.parse(layer.options);
        } catch {
          return {
            success: false,
            message: 'Invalid options configuration on this layer.',
          };
        }
      }

      const questionType = String(layer.question_type).toLowerCase();

      if (questionType === 'option') {
        const normalizedOptions = options.map((o) =>
          String(o).trim().toLowerCase(),
        );
        for (const answer of response.responses) {
          const a = String(answer).trim().toLowerCase();
          const valid = normalizedOptions.includes(a);
          const isOther = layer.other && a.startsWith('other:');
          if (!valid && !isOther) {
            return {
              success: false,
              message: `"${answer}" is not a valid option for this question.`,
            };
          }
        }
      }

      if (questionType === 'text') {
        if (
          response.responses.length !== 1 ||
          typeof response.responses[0] !== 'string'
        ) {
          return {
            success: false,
            message: 'Text question requires exactly one string answer.',
          };
        }
      }
    }

    // Save responses
    const savedResponses = await this.prisma.$transaction(
      createdResponses.map((r) =>
        this.prisma.digResponse.create({
          data: {
            dig_id: digId,
            layer_id: r.layer_id,
            user_id: userId,
            response: JSON.stringify(r.responses),
          },
        }),
      ),
    );

    // Compute points from already-fetched layers (no extra query needed)
    const totalPoints = layers.reduce((sum, l) => sum + (l.point ?? 0), 0);

    // Check completion
    const newTotalCompleted = completedLayers + savedResponses.length;
    const isDigCompleted = newTotalCompleted >= totalLayers;

    if (isDigCompleted) {
      const userPlan = await SubscriptionManager(this.prisma, userId);
      const isFreeUser = userPlan.subscriptionName === 'free';

      if (isFreeUser) {
        const { weekStart } = getWeekBoundaries();
        await this.prisma.userWeeklyDig.updateMany({
          where: { userId, digId, weekStart },
          data: { completed: true },
        });
      } else {
        await this.prisma.userDailyDig.updateMany({
          where: { userId, digId },
          data: { completed: true },
        });
      }

      if (user.type !== 'admin') {
        await this.prisma.digs.update({
          where: { id: digId },
          data: { answeredCount: { increment: 1 } },
        });
      }
    }

    if (user.type !== 'admin' && totalPoints > 0) {
      const newTotalXp = (user.acheivedXp ?? 0) + totalPoints;
      const newLevel = getLevelFromTotalXp(newTotalXp);
      await this.prisma.user.update({
        where: { id: userId },
        data: { acheivedXp: newTotalXp, currentLevel: newLevel },
      });
    }

    return {
      success: true,
      data: savedResponses,
      totalPoints,
      digCompleted: isDigCompleted,
      progress: `${newTotalCompleted}/${totalLayers}`,
    };
  }

  async getPointsdict(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { success: false, message: 'User not found' };

      const answeredOrNot = await this.prisma.digResponse.findMany({
        where: { user_id: userId },
        select: { dig_id: true, layer_id: true, response: true },
      });

      if (answeredOrNot.length === 0) {
        return {
          success: true,
          message: 'No digs attempted',
          data: 0,
        };
      }

      const getAnsDigsLayerPoints = await this.prisma.layers.findMany({
        where: { dig_id: answeredOrNot[0].dig_id },
        select: { id: true, point: true },
      });

      const totalpointsForCurrentuser = answeredOrNot.reduce((acc, curr) => {
        const layerPoint = getAnsDigsLayerPoints.find(
          (layer) => layer.id === curr.layer_id,
        )?.point;
        return acc + (layerPoint || 0);
      }, 0);

      return {
        success: true,
        message: 'Points retrieved successfully',
        data: totalpointsForCurrentuser,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getAlldigs(
    userId: string,
    paginationDto: { page?: number; perPage?: number },
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { success: false, message: 'User not found' };

      const page = paginationDto.page || 1;
      const perPage = paginationDto.perPage || 10;
      const skip = (page - 1) * perPage;

      const answers = await this.prisma.digResponse.findMany({
        where: { user_id: userId },
      });
      const answeredDigIds = new Set(answers.map((a) => a.dig_id));

      const total = await this.prisma.digs.count();

      const digs = await this.prisma.digs.findMany({
        skip,
        take: perPage,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          layers: true,
        },
      });
      const digsWithStatus = digs.map((dig) => ({
        ...dig,
        is_completed: answeredDigIds.has(dig.id),
      }));

      return {
        success: true,
        message: 'Digs retrieved successfully',
        data: digsWithStatus,
        pagination: {
          total,
          page,
          perPage,
          totalPages: Math.ceil(total / perPage),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getDigResponses(digId: string) {
    try {
      const responses = await this.prisma.digResponse.findMany({
        where: { dig_id: digId },
      });
      return { success: true, data: responses };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving dig responses',
        error: error.message,
      };
    }
  }

  async getSingleDig(digId: string) {
    try {
      const dig = await this.prisma.digs.findUnique({
        where: { id: digId },
        include: { layers: true },
      });
      if (!dig) {
        return { success: false, message: 'Dig not found' };
      }
      return { success: true, data: dig };
    } catch (error) {
      throw error;
    }
  }

  async updateDig(id, userId, updateDig) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.digs.update({
      where: {
        id,
      },
      data: {
        title: updateDig.title,
        layers: {
          deleteMany: {}, // delete existing layers
          create: updateDig.layers?.map((layer) => ({
            question_name: layer.question_name,
            question_type: layer.question_type,
            point: layer.point,
            question: layer.question,
            options: layer.options,
            other: layer.other,
            other_text: layer.other_text,
            text: layer.text,
          })),
        },
      },
    });

    return {
      success: true,
      message: 'Dig Update Successful',
      updated,
    };
  }

  async deleteDig(id, userId) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        type: 'admin',
      },
    });
    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    const dig = await this.prisma.digs.findFirst({
      where: {
        id: id,
      },
    });
    if (!dig) throw new NotFoundException('Dig not found');
    await this.prisma.digs.delete({
      where: {
        id: id,
      },
    });
    return {
      success: true,
      message: 'Digs deleted successfully',
    };
  }
}
