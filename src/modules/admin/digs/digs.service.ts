import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDigDto, SaveResponseItemDto } from './dto/create-dig.dto';
import { UpdateDigDto } from './dto/update-dig.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { validate } from 'class-validator';
import e from 'express';
import { boolean } from 'zod';

@Injectable()
export class DigsService {
  constructor(private readonly prisma: PrismaService) {}

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

      const createdDig = await this.prisma.digs.create({
        data: {
          title: createDigDto.title,
          user_id: userid,
          layers: {
            create: createDigDto.layers.map((layer) => ({
              question_name: layer.question_name,
              question_type: layer.question_type,
              point: layer.point,
              question: layer.question,
              options: layer.options || [],
              other: layer.other,
              other_text: layer.other_text,
              text: layer.text,
            })),
          },
        },
        include: {
          layers: true,
        },
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
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { success: false, message: 'User not found' };

      const dig = await this.prisma.digs.findUnique({ where: { id: digId } });
      if (!dig) return { success: false, message: 'Dig not found' };

      const alreadyResponded = await this.prisma.digResponse.findFirst({
        where: { dig_id: digId, user_id: userId },
      });
      if (alreadyResponded)
        return {
          success: false,
          message: 'User has already responded to this dig',
        };

      const layerIds = createdResponses.map((r) => r.layer_id);

      const layers = await this.prisma.layers.findMany({
        where: { id: { in: layerIds }, dig_id: digId },
        select: { id: true, question_type: true, options: true, other: true },
      });
      if (layers.length !== layerIds.length)
        return {
          success: false,
          message: 'One or more layers do not belong to this dig',
        };

      const layerMap = new Map(layers.map((l) => [l.id, l]));

      for (const response of createdResponses) {
        const layer = layerMap.get(response.layer_id);
        if (!layer)
          return {
            success: false,
            message: `Layer does not belong to this dig`,
          };

        const questionType = String(layer.question_type).toLowerCase();
        let options: string[] = [];
        if (Array.isArray(layer.options)) options = layer.options;
        else if (typeof layer.options === 'string') {
          try {
            options = JSON.parse(layer.options);
          } catch {
            return {
              success: false,
              message: `Invalid options entered`,
            };
          }
        }

        if (questionType === 'option') {
          const normalizedOptions = options.map((o) =>
            String(o).trim().toLowerCase(),
          );
          for (const answer of response.responses) {
            const a = String(answer).trim().toLowerCase();
            const validOption = normalizedOptions.includes(a);
            const isOther = layer.other && a.startsWith('other:');
            if (!validOption && !isOther)
              return {
                success: false,
                message: `Invalid option entered`,
              };
          }
        }

        if (questionType === 'text') {
          if (
            response.responses.length !== 1 ||
            typeof response.responses[0] !== 'string'
          )
            return {
              success: false,
              message: `Invalid text response for layer ${layer.id}`,
            };
        }
      }

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

      return { success: true, data: savedResponses };
    } catch (error) {
      return {
        success: false,
        message: 'Error saving user responses',
        error: error.message,
      };
    }
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
  async getAlldigs(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { success: false, message: 'User not found' };

      const answers = await this.prisma.digResponse.findMany({
        where: { user_id: userId },
      });
      const answeredDigIds = new Set(answers.map((a) => a.dig_id));

      const digs = await this.prisma.digs.findMany({
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
}
