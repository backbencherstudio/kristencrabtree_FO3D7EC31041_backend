import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// import { PaginationDto } from 'src/common/pagination/paginatio.dto';

@Injectable()
export class ContentManagementService {
  constructor(private readonly prisma: PrismaService) {}

  //Meditations management start
  async create(
    user_id: string,
    createContentManagementDto: CreateContentManagementDto,
    audio?: Express.Multer.File,
  ) {
    if (!user_id) {
      return { success: false, message: 'User ID is required' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id, type: 'admin' },
    });

    if (!user) {
      return { success: false, message: 'Admin not found' };
    }

    if (!audio) {
      return {
        success: false,
        message: 'Audio file is required for audio type',
      };
    }

    const fileName = `${StringHelper.randomString()}-${audio.originalname}`;

    // Upload to storage
    await SojebStorage.put(
      appConfig().storageUrl.audio + fileName,
      audio.buffer,
    );
    // Extract duration via temporary file
    let durationSeconds: number | null = null;
    let tempFilePath: string | null = null;

    try {
      tempFilePath = path.join(
        os.tmpdir(),
        `audio-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
      );

      await fs.writeFile(tempFilePath, audio.buffer);

      durationSeconds = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
          if (err) {
            return reject(err);
          }
          const duration = metadata.format?.duration;
          if (
            typeof duration === 'number' &&
            !isNaN(duration) &&
            duration > 0
          ) {
            resolve(duration);
          } else {
            reject(new Error('Duration not found or invalid in metadata'));
          }
        });
      });
    } catch (error) {
      console.error('Failed to extract audio duration:', error);
    } finally {
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupErr) {
          console.warn('Failed to clean up temp file:', cleanupErr);
        }
      }
    }

    // Format duration string
    let durationInString: string | null = null;
    if (durationSeconds && durationSeconds > 0) {
      const minutes = Math.round(durationSeconds / 60);
      durationInString = `${minutes} minutes`;
    }

    const newMeditation = await this.prisma.meditation.create({
      data: {
        meditation_name: createContentManagementDto.meditation_name,
        meditation_description:
          createContentManagementDto.meditation_description,
        meditation_audio: fileName,
        duration: durationInString || null,
      },
    });

    if (newMeditation.meditation_audio) {
      newMeditation['meditation_audio'] = SojebStorage.url(
        appConfig().storageUrl.audio + fileName,
      );
    }

    return {
      success: true,
      message: 'Meditation created successfully',
      data: newMeditation,
    };
  }

  async findAllMeditations(
    userId: string,
    paginationDto: { page?: number; perPage?: number } = {},
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const page = paginationDto.page || 1;
      const perPage = paginationDto.perPage || 10;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const meditations = await this.prisma.meditation.findMany({
        skip,
        take,
        orderBy: {
          created_at: 'desc', // or 'asc'
        },
        include: {
          _count: {
            select: {
              listeners: true,
              favoriteMeditations: {
                where: {
                  user_id: userId,
                  deleted_at: null,
                },
              },
            },
          },
        },
      });

      const total = await this.prisma.meditation.count();

      if (meditations.length === 0) {
        return {
          success: false,
          message: 'Currently no meditations available',
        };
      }

      const data = meditations.map((meditation) => ({
        ...meditation,
        listenersCount: meditation._count.listeners,
        isFav: meditation._count.favoriteMeditations > 0,
        _count: undefined,
        meditation_audio: SojebStorage.url(
          appConfig().storageUrl.audio + meditation.meditation_audio,
        ),
      }));

      return {
        success: true,
        message: 'Meditations retrieved successfully',
        data,
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

  async update(
    user_id: string,
    meditation_id: string,
    UpdateContentManagementDto: CreateContentManagementDto,
    audio?: Express.Multer.File,
  ) {
    if (!user_id) {
      return { success: false, message: 'User ID is required' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: user_id, type: 'admin' },
    });

    if (!user) {
      return { success: false, message: 'Admin not found' };
    }

    const meditation = await this.prisma.meditation.findUnique({
      where: { id: meditation_id },
    });

    if (!meditation) {
      return { success: false, message: 'Meditation not found' };
    }

    if (audio) {
      if (meditation.meditation_audio) {
        await SojebStorage.delete(
          appConfig().storageUrl.audio + meditation.meditation_audio,
        );
      }

      const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.audio + fileName,
        audio.buffer,
      );

      meditation.meditation_audio = fileName;
    }

    const updatedMeditation = await this.prisma.meditation.update({
      where: { id: meditation_id },
      data: {
        meditation_name: UpdateContentManagementDto.meditation_name,
        meditation_description:
          UpdateContentManagementDto.meditation_description,
        meditation_audio: meditation.meditation_audio,
      },
    });

    return {
      success: true,
      message: 'Meditation updated successfully',
      data: updatedMeditation,
    };
  }

  // async updateMediCount(user_id, meditation_id) {
  //   const meditation = await this.prisma.meditation.findUnique({
  //     where: { id: meditation_id },
  //   });
  //   if (!meditation) {
  //     return { success: false, message: 'Meditation not found' };
  //   }
  //   const updatedMeditation = await this.prisma.meditation.update({
  //     where: { id: meditation_id },
  //     data: {
  //       listeningCount: meditation.listening_count + 1,
  //     },
  //   });
  //   return {
  //     success: true,
  //     message: 'Meditation listening count updated successfully',
  //     data: updatedMeditation,
  //   };
  // }

  async addListener(userId: string, meditationId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!user) {
        return {
          success: false,
          message: 'No user found',
        };
      }
      const checkAlready = await this.prisma.meditationListener.findUnique({
        where: {
          userId_meditationId: {
            userId: userId,
            meditationId: meditationId,
          },
        },
      });

      if (checkAlready) {
        return {
          success: false,
          message: 'Already a listener',
        };
      }

      await this.prisma.meditationListener.create({
        data: {
          userId,
          meditationId,
        },
      });

      return {
        success: true,
        message: 'Added listener successfully',
        liked: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async addFavoriteMeditation(userId: string, meditationId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      const checkMeditation = await this.prisma.meditation.findUnique({
        where: { id: meditationId },
      });
      if (!checkMeditation) {
        return { success: false, message: 'Meditation not found' };
      }

      const existingFavorite = await this.prisma.favoriteMeditation.findFirst({
        where: {
          user_id: userId,
          meditation_id: meditationId,
        },
      });
      if (existingFavorite) {
        await this.prisma.favoriteMeditation.delete({
          where: { id: existingFavorite.id },
        });
        return {
          success: true,
          message: 'Favorite meditation removed successfully',
        };
      } else {
        await this.prisma.favoriteMeditation.create({
          data: {
            user_id: userId,
            meditation_id: meditationId,
          },
        });

        return {
          success: true,
          message: 'Favorite meditation added successfully',
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async getFavoriteMeditations(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      const favorites = await this.prisma.favoriteMeditation.findMany({
        where: { user_id: userId },
        include: {
          meditation: true,
        },
      });
      if (favorites.length === 0) {
        return {
          success: true,
          message: 'No favorite meditations found',
          data: [],
        };
      }
      return {
        success: true,
        message: 'Favorite meditations retrieved successfully',
        data: favorites,
      };
    } catch (error) {
      throw error;
    }
  }

  async getOneMeditation(id) {
    const meditation = await this.prisma.meditation.findFirst({
      where: {
        id: id,
      },
    });
    if (!meditation) {
      return {
        success: false,
        message: 'Meditation not found',
      };
    }
    if (meditation.meditation_audio) {
      meditation['meditation_audio'] = SojebStorage.url(
        appConfig().storageUrl.audio + meditation.meditation_audio,
      );
    }
    return {
      success: true,
      message: 'Meditation fetch successfull',
      data: meditation,
    };
  }

  async remove(userid: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userid,
      },
    });
    if (user) {
      if (user.type === 'admin') {
        await this.prisma.meditation.delete({
          where: {
            id: id,
          },
        });
      } else {
        return {
          success: false,
          message:
            'User not found or you dont have permission to delete the meditation',
        };
      }
    }
    return {
      success: true,
      message: 'Deletation of meditation successfull',
    };
  }
  //Meditations management end

  //qoute management start
  async findAllQoutes(
    userId: string,
    paginationDto: { page?: number; perPage?: number } = {},
  ) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'Authentication error',
        };
      }

      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          type: 'admin',
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'No user found',
        };
      }

      const page = Number(paginationDto.page) || 1;
      const perPage = Number(paginationDto.perPage) || 10;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const total = await this.prisma.quote.count({
        where: {
          user: {
            type: 'admin',
          },
        },
      });

      const quotes = await this.prisma.quote.findMany({
        where: {
          user: {
            type: 'admin',
          },
        },
        skip,
        take,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              type: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              quoteReactions: true,
            },
          },
        },
      });

      const quotesWithLikes = quotes.map((quote) => ({
        ...quote,
        likeCount: quote._count.quoteReactions,
      }));

      return {
        success: true,
        message: 'Quotes retrieved successfully',
        data: quotesWithLikes,
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

  async updateQuoteStatus(userId: string, quoteId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          type: 'admin',
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'Admin user not found',
        };
      }

      const quote = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          user: {
            select: {
              type: true,
            },
          },
        },
      });

      if (!quote || quote.user.type !== 'admin') {
        return {
          success: false,
          message: 'Quote not found or not created by admin',
        };
      }

      await this.prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: !quote.status,
        },
      });

      return {
        success: true,
        message: `Quote status changed to ${!quote.status}`,
      };
    } catch (error) {
      throw error;
    }
  }
  //qoute management end
}
