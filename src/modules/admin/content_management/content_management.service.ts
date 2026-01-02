import { Injectable } from '@nestjs/common';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

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

    await SojebStorage.put(
      appConfig().storageUrl.audio + fileName,
      audio.buffer,
    );

    const newMeditation = await this.prisma.meditation.create({
      data: {
        meditation_name: createContentManagementDto.meditation_name,
        meditation_description:
          createContentManagementDto.meditation_description,
        meditation_audio: fileName,
      },
    });

    return {
      success: true,
      message: 'Meditation created successfully',
      data: newMeditation,
    };
  }
  async findAllMeditations(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const meditations = await this.prisma.meditation.findMany({
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
      }));

      return {
        success: true,
        message: 'Meditations retrieved successfully',
        data,
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
  async addListener(userId: string, meditationId: string) {
  try {

    const user = await this.prisma.user.findUnique({
      where:{
        id:userId
      }
    })
    if(!user){
       return {
        success: false,
        message: "No user found",
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
        message: "Already a listener",
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
      message: "Added listener successfully",
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
  remove(userid: string, id: string) {
    return `This action removes a #${id} contentManagement`;
  }
  //Meditations management end

  //qoute management start
  async findAllQoutes(userId: string) {
    try {
      if (!userId) {
        return {
          success: false,
          message: 'Authentication error',
        };
      }
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          type: 'admin',
        },
      });

      if (!user) {
        return {
          Success: false,
          message: 'No user found',
        };
      }

      const quotes = await this.prisma.quote.findMany({
        where: {
          user: {
            type: 'admin',
          },
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

      if (quotes.length === 0) {
        return {
          success: false,
          message: 'No admin quotes found',
        };
      }

      // Add like count to each quote
      const quotesWithLikes = quotes.map((quote) => ({
        ...quote,
        // likeCount: quote._count.quoteReactions,
      }));

      return {
        Success: true,
        message: 'Quotes retrieved successfully',
        data: quotesWithLikes,
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
