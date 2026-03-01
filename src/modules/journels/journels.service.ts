import { Injectable } from '@nestjs/common';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { SubscriptionManager } from 'src/common/helper/subscription.manager';

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

      if (user.type !== 'admin') {
        const checkPermission = await SubscriptionManager(this.prisma, user_id);

        if (
          checkPermission.subscriptionName === 'free' &&
          createJournelDto.type === 'Audio'
        ) {
          return {
            success: false,
            message: 'You cant upload audio in free plan',
          };
        }
        // console.log(checkPermission);
        // console.log(checkPermission.journal_entries);  // eita free plan hole 2 return kore ar monthly/yearly hole infinity return kore

        if (checkPermission.journal_entries !== Infinity) {
          const journelCheck = await this.prisma.journel.count({
            where: {
              user_id: user_id,
              created_at: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)), // Start of the day
                lte: new Date(new Date().setHours(23, 59, 59, 999)), // End of the day
              },
            },
          });
          if (journelCheck >= checkPermission.journal_entries) {
            return {
              success: false,
              message: `Journal entry limit reached. Your current plan allows for ${checkPermission.journal_entries} entries per day. Please upgrade your subscription to add more entries.`,
            };
          }
        }
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

  // async findAll(userId:string) {
  //   try {

  //     const user = await this.prisma.user.findUnique({
  //       where:{
  //         id:userId
  //       }
  //     })
  //     if(!user){
  //       return{
  //         success:false ,
  //         message:"user not found"
  //       }
  //     }

  //     const journels = await this.prisma.journel.findMany({
  //       include: {
  //         _count: {
  //           select: { likeJournels: true },
  //         },
  //       },
  //     });

  //     if (journels.length === 0) {
  //       return {
  //         success: true,
  //         message: 'No journels found, please create one',
  //         data: [],
  //       };
  //     }

  //     const result = journels.map(({ _count, ...journel }) => ({
  //       ...journel,
  //       likeCount: _count.likeJournels,
  //     }));

  //     return {
  //       success: true,
  //       message: 'Journels retrieved successfully',
  //       data: result,
  //     };
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  async findAll(
    userId,
    paginationDto: { page?: number; perPage?: number } = {},
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const page = Number(paginationDto.page) || 1;
      const perPage = Number(paginationDto.perPage) || 10;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const total = await this.prisma.journel.count({
        where: { user_id: userId },
      });

      const journals = await this.prisma.journel.findMany({
        skip,
        take,
        include: {
          _count: {
            select: { likeJournels: true },
          },
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              avatar: true,
            },
          },
          likeJournels: {
            where: {
              userId: userId,
            },
          },
        },
      });

      if (journals.length === 0) {
        return {
          success: true,
          message: 'No journals found, please create one',
          data: [],
        };
      }

      journals.forEach((item) => {
        if (item.audio) {
          item['audio'] = SojebStorage.url(
            appConfig().storageUrl.audio + '/' + item.audio,
          );
        }

        // Add full name
        item.user['name'] =
          [item.user.first_name, item.user.last_name]
            .filter(Boolean)
            .join(' ') || null;
      });

      const result = journals.map(({ _count, likeJournels, ...journel }) => ({
        ...journel,
        likeCount: _count.likeJournels,
        isLiked: likeJournels.length > 0,
      }));

      return {
        success: true,
        message: 'Journals retrieved successfully',
        data: result,
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

  async getRecommendedJournals(userId: string) {
    const journals = await this.prisma.journel.findMany({
      where: {
        user_id: { not: userId },
      },
      include:{
        user:{
          select:{
            id:true,
            first_name:true,
            last_name:true,
            avatar:true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 10,
    });

    journals.forEach((item) => {
      if (item.audio) {
        item['audio'] = SojebStorage.url(
          appConfig().storageUrl.audio + '/' + item.audio,
        );
      }
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
      if (journel.audio) {
        journel['audio'] = SojebStorage.url(
          appConfig().storageUrl.audio + '/' + journel.audio,
        );
      }
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
      if (!journal) {
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
