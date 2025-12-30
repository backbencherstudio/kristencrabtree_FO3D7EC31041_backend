import { Injectable } from '@nestjs/common';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';

@Injectable()
export class JournelsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    user_id: string,
    createJournelDto: CreateJournelDto,
    audio?: Express.Multer.File,
  ) {
    try {
      if (!user_id) {
        return { success: false, message: 'User ID is required' };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      let journelData: any = { ...createJournelDto, user_id };

      if (createJournelDto.type === 'Audio') {
        if (!audio) {
          return {
            success: false,
            message: 'Audio file is required for audio type',
          };
        }

        const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.audio + fileName,
          audio.buffer,
        );
        journelData.audio = fileName;
        delete journelData.body;
      } else if (createJournelDto.type === 'Text') {
        if (audio) {
          return {
            success: false,
            message: 'Text type cannot have audio content',
          };
        }
        delete journelData.audio;
      }

      const newJournel = await this.prisma.journel.create({
        data: journelData,
      });

      return {
        success: true,
        message: 'Journel created successfully',
        data: newJournel,
      };
    } catch (error) {
      throw error;
    }
  }
  async findAll(userId: string) {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      let isLikedAJournel = async (journelId: strinyag) => {
        const like = await this.prisma.likeJournel.findUnique({
          where: {
            userId_journelId: {
              userId: userId,
              journelId: journelId,
            },
          },
        });
        return !!like;
      }

      const journels = await this.prisma.journel.findMany({
        include: {
          _count: {
            select: { likeJournels: true },
          },
        },
      });

      if (journels.length === 0) {
        return {
          success: true,
          message: 'No journels found, please create one',
          data: [],
        };
      }

      const result = journels.map(async ({ _count, ...journel }) => ({
        ...journel,
        likeCount: _count.likeJournels,
        //isLiked: await isLikedAJournel(journel.id),
      }));

      return {
        success: true,
        message: 'Journels retrieved successfully',
        data: result,
      };
    } catch (error) {
      throw error;
    }
  }
  async getRecommendedJournals(userId: string) {
    const journals = await this.prisma.journel.findMany({
      where: {
        user_id: { not: userId },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 10,
    });

    return {
      success: true,
      message: 'Recommended journals retrieved successfully',
      data: journals,
    };
  }
  async getPersonalJournals(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const journals = await this.prisma.journel.findMany({
        where: {
          user_id: userId,
        },
        orderBy: {
          created_at: 'desc',
        },
        include: {
          _count: {
            select: { likeJournels: true },
          },
        },
      });

      const result = journals.map(({ _count, ...journal }) => ({
        ...journal,
        likeCount: _count.likeJournels,
      }));

      return {
        success: true,
        message: 'Personal journals retrieved successfully',
        data: result,
      };
    } catch (error) {
      throw error;
    }
  }
  async findOne(user_id: string, id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const journel = await this.prisma.journel.findUnique({
        where: { id, user_id },
      });

      return {
        success: true,
        message: 'Journel retrieved successfully',
        data: journel,
      };
    } catch (error) {
      throw error;
    }
  }
  async toggleLike(userId: string, journelId: string) {
    try {
      await this.prisma.likeJournel.create({
        data: { userId, journelId },
      });

      return {
        success: true,
        message: 'Journel liked successfully',
        liked: true,
      };
    } catch (error) {
      await this.prisma.likeJournel.delete({
        where: {
          userId_journelId: {
            userId,
            journelId,
          },
        },
      });

      return {
        success: true,
        message: 'Journel unliked successfully',
        liked: false,
      };
    }
  }
  async update(
    user_id: string,
    id: string,
    updateJournelDto: UpdateJournelDto,
    audio?: Express.Multer.File,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const journal = await this.prisma.journel.findUnique({
        where: { id },
      });
      if (!journal || journal.user_id !== user_id) {
        return {
          success: false,
          message: 'Unauthorized to update this journal',
        };
      }

      let updateData: any = { ...updateJournelDto };

      if (updateJournelDto.type) {
        if (updateJournelDto.type === 'Audio') {
          if (!audio && !journal.audio) {
            return {
              success: false,
              message: 'Audio file is required for audio type',
            };
          }

          if (audio) {
            if (journal.audio) {
              await SojebStorage.delete(
                appConfig().storageUrl.audio + journal.audio,
              );
            }

            const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
            await SojebStorage.put(
              appConfig().storageUrl.audio + fileName,
              audio.buffer,
            );
            updateData.audio = fileName;
          }

          delete updateData.body;
        } else if (updateJournelDto.type === 'Text') {
          if (journal.audio) {
            await SojebStorage.delete(
              appConfig().storageUrl.audio + journal.audio,
            );
          }
          delete updateData.audio;
          updateData.audio = null;
        }
      }

      const updatedJournal = await this.prisma.journel.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        message: 'Journal updated successfully',
        data: updatedJournal,
      };
    } catch (error) {
      throw error;
    }
  }
  async remove(user_id: string, id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      const journal = await this.prisma.journel.findUnique({
        where: { id, user_id },
      });
      if (!journal || journal.user_id !== user_id) {
        return {
          success: false,
          message: 'Unauthorized to delete this journal',
        };
      }
      await this.prisma.journel.delete({
        where: { id, user_id },
      });
      return {
        success: true,
        message: 'Journal deleted successfully',
      };
    } catch (error) {
      throw error;
    }
  }
}
