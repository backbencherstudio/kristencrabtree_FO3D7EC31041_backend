import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDigDto, SaveResponseItemDto } from './dto/create-dig.dto';
import { UpdateDigDto } from './dto/update-dig.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { validate } from 'class-validator';

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
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const dig = await this.prisma.digs.findUnique({
        where: { id: digId },
      });
      if (!dig) {
        return { success: false, message: 'Dig not found' };
      }

      const alreadyResponded = await this.prisma.digResponse.findFirst({
        where: {
          dig_id: digId,
          user_id: userId,
        },
      });

      if (alreadyResponded) {
        return {
          success: false,
          message: 'User has already responded to this dig',
        };
      }

      const layerIds = createdResponses.map((r) => r.layer_id);

      const layers = await this.prisma.layers.findMany({
        where: { id: { in: layerIds } },
        select: { id: true },
      });

      if (layers.length !== layerIds.length) {
        return {
          success: false,
          message: 'One or more layers not found',
        };
      }

      const savedResponses = await this.prisma.$transaction(
        createdResponses.map((response) =>
          this.prisma.digResponse.create({
            data: {
              dig_id: digId,
              layer_id: response.layer_id,
              user_id: userId,
              response: JSON.stringify(response.responses),
            },
          }),
        ),
      );

      return {
        success: true,
        data: savedResponses,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error saving user responses',
        error: error.message,
      };
    }
  }
  async getAlldigs() {
    try {
      const getAlldigs = await this.prisma.digs.findMany({
        include: {
          layers: {},
        },
      });

      if (getAlldigs.length === 0) {
        return {
          success: false,
          message: 'No digs found',
        };
      }

      return {
        success: true,
        message: 'Digs retrieved successfully',
        data: getAlldigs,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving digs',
        error: error.message,
      };
    }
  }
}
