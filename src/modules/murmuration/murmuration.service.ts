import { Injectable } from '@nestjs/common';
import {
  CreateCommentDto,
  CreateMurmurationDto,
} from './dto/create-murmuration.dto';
import { UpdateMurmurationDto } from './dto/update-murmuration.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { MurmurationType } from '@prisma/client';

@Injectable()
export class MurmurationService {
  constructor(private prisma: PrismaService) {}
  async create(
    user_id: string,
    dto: CreateMurmurationDto,
    audio?: Express.Multer.File,
    image?: Express.Multer.File,
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

      const data: any = {
        user_id,
        type: dto.type,
        title: dto.title ?? null,
        text: null,
        audio: null,
        image: null,
      };

      switch (dto.type) {
        case MurmurationType.Text:
          if (dto.title) {
            return {
              success: false,
              message: 'Title is not allowed for text type',
            };
          }

          if (!dto.text) {
            return {
              success: false,
              message: 'Text is required for text type',
            };
          }

          if (audio) {
            return {
              success: false,
              message: 'Audio is not allowed for text type',
            };
          }
          if (image) {
            return {
              success: false,
              message: 'Image is not allowed for text type',
            };
          }

          data.text = dto.text;
          break;

        case MurmurationType.Audio:
          if (!audio) {
            return {
              success: false,
              message: 'Audio file is required for audio type',
            };
          }

          if (dto.text) {
            return {
              success: false,
              message: 'Text is not allowed for audio type',
            };
          }

          if (image) {
            return {
              success: false,
              message: 'Image is not allowed for audio type',
            };
          }

          if (!dto.title) {
            return {
              success: false,
              message: 'Title is required for audio type',
            };
          }

          const audioName = `${StringHelper.randomString()}-${audio.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.audio + audioName,
            audio.buffer,
          );

          data.audio = audioName;
          break;

        case MurmurationType.Image:
          if (!image) {
            return {
              success: false,
              message: 'Image file is required for image type',
            };
          }
          if (dto.text) {
            return {
              success: false,
              message: 'Text is not allowed for audio type',
            };
          }

          if (audio) {
            return {
              success: false,
              message: 'Audio is not allowed for image type',
            };
          }

          if (!dto.title) {
            return {
              success: false,
              message: 'Title is required for audio type',
            };
          }

          const imageName = `${StringHelper.randomString()}-${image.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.image + imageName,
            image.buffer,
          );

          data.image = imageName;
          break;

        default:
          return {
            success: false,
            message: 'Invalid murmuration type',
          };
      }

      const murmuration = await this.prisma.murmuration.create({
        data,
      });

      return {
        success: true,
        message: 'Murmuration created successfully',
        data: murmuration,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create murmuration',
        error: error.message || error,
      };
    }
  }
  async findAll() {
    try {
      const murmurations = await this.prisma.murmuration.findMany({
        include: {
          _count: {
            select: { murmurationLikes: true, comments: true },
          },
        },
      });
      return {
        success: true,
        message: 'Murmurations fetched successfully',
        data: murmurations,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch murmurations',
        error: error.message || error,
      };
    }
  }
  async findOne(id: string) {
    try {
      const murmuration = await this.prisma.murmuration.findUnique({
        where: { id },
        include: {
          comments: {
            where: {
              reply_to_comment_id: null,
              deleted_at: null,
            },
            orderBy: { created_at: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  commentLikes: true,
                  comments: true,
                },
              },
              comments: {
                where: { deleted_at: null },
                orderBy: { created_at: 'asc' },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      avatar: true,
                    },
                  },
                  _count: {
                    select: {
                      commentLikes: true,
                      comments: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              murmurationLikes: true,
              comments: true,
            },
          },
        },
      });

      if (!murmuration) {
        return {
          success: false,
          message: 'Murmuration not found',
        };
      }

      const formatted = {
        id: murmuration.id,
        created_at: murmuration.created_at,
        updated_at: murmuration.updated_at,
        type: murmuration.type,
        title: murmuration.title,
        text: murmuration.text,
        image: murmuration.image,
        audio: murmuration.audio,
        post_counts: {
          likes: murmuration._count.murmurationLikes,
          comments: murmuration._count.comments,
        },
        comments: murmuration.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          created_at: comment.created_at,
          user: comment.user,
          comment_counts: {
            likes: comment._count.commentLikes,
            replies: comment._count.comments,
          },
          replies: comment.comments.map((reply) => ({
            id: reply.id,
            body: reply.body,
            created_at: reply.created_at,
            user: reply.user,
            comment_counts: {
              likes: reply._count.commentLikes,
              replies: reply._count.comments,
            },
          })),
        })),
      };

      return {
        success: true,
        message: 'Murmuration fetched successfully',
        data: formatted,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch murmuration',
        error: error.message || error,
      };
    }
  }
  remove(id: string) {
    return `This action removes a #${id} murmuration`;
  }

  //comments , reply , like and share

  async addComment(
    user_id: string,
    murmuration_id: string,
    createCommentDto: CreateCommentDto,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const murmuration = await this.prisma.murmuration.findUnique({
        where: { id: murmuration_id },
      });
      if (!murmuration) {
        return { success: false, message: 'Murmuration not found' };
      }
      const comment = await this.prisma.comments.create({
        data: {
          user_id,
          murmuration_id,
          body: createCommentDto.body,
          reply_to_comment_id: createCommentDto.reply_to_comment_id || null,
        },
      });

      return {
        success: true,
        message: 'Comment added successfully',
        data: comment,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch murmurations',
        error: error.message || error,
      };
    }
  }
  async getCommentsForMurmuration(murmurationId: string) {
    try {
      const comments = await this.prisma.comments.findMany({
        where: { murmuration_id: murmurationId },
        include: {
          _count: { select: { commentLikes: true, comments: true } },
        },
      });
      return {
        success: true,
        message: 'Comments fetched successfully',
        data: comments,
      };
    } catch (error) {}
  }
  async toggleLikeForMurmuration(userId: string, murmurationId: string) {
    try {
      await this.prisma.murmurationLike.create({
        data: { userId, murmurationId },
      });

      return {
        success: true,
        message: 'Murmuration liked successfully',
        liked: true,
      };
    } catch (error) {
      await this.prisma.murmurationLike.delete({
        where: {
          userId_murmurationId: {
            userId,
            murmurationId,
          },
        },
      });

      return {
        success: true,
        message: 'Murmuration unliked successfully',
        liked: false,
      };
    }
  }
  async toggleLikeForComment(userId: string, commentId: string) {
    try {
      await this.prisma.commentLike.create({
        data: { userId, commentId },
      });

      return {
        success: true,
        message: 'Comment liked successfully',
        liked: true,
      };
    } catch (error) {
      await this.prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      return {
        success: true,
        message: 'Comment unliked successfully',
        liked: false,
      };
    }
  }
  async shareMurmuration() {}
}
