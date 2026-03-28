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
import { SubscriptionManager } from 'src/common/helper/subscription.manager';

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

      const userPlan = await SubscriptionManager(this.prisma, user.id);

      if (userPlan.subscriptionName === 'free') {
        return {
          success: false,
          message: 'Upgrade your plan to Post',
        };
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

  async findAll(user_id: string, cursor: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const murmurations = await this.prisma.murmuration.findMany({
        take: 10,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          type: true,
          text: true,
          title: true,
          image: true,
          audio: true,
          created_at: true,
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
              murmurationLikes: true,
              comments: true,
            },
          },
          murmurationLikes: {
            where: {
              userId: user_id,
            },
          },
        },
      });

      const data = murmurations.map((m) => ({
        id: m.id,
        type: m.type,
        text: m.text,
        title: m.title,
        media: {
          image: m.image,
          audio: m.audio,
        },
        createdAt: m.created_at,
        user: m.user,
        stats: {
          likes: m._count.murmurationLikes,
          comments: m._count.comments,
        },
        isLiked: m.murmurationLikes.length > 0,
      }));

      const nextCursor =
        murmurations.length === 10
          ? murmurations[murmurations.length - 1].id
          : null;

      return {
        success: true,
        message: 'Murmurations fetched successfully',
        data,
        meta: {
          nextCursor,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch murmurations',
        error: error.message || error,
      };
    }
  }

  async findOne(id: string, user_id: string) {
    try {
      const murmuration = await this.prisma.murmuration.findUnique({
        where: { id },
        select: {
          id: true,
          created_at: true,
          updated_at: true,
          type: true,
          title: true,
          text: true,
          image: true,
          audio: true,
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
              murmurationLikes: true,
              comments: true,
            },
          },
          murmurationLikes: {
            where: {
              userId: user_id,
            },
          },
          comments: {
            where: {
              reply_to_comment_id: null,
              deleted_at: null,
            },
            orderBy: { created_at: 'asc' },
            select: {
              id: true,
              body: true,
              created_at: true,
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
              commentLikes: {
                where: {
                  userId: user_id,
                },
              },
              comments: {
                where: {
                  deleted_at: null,
                },
                orderBy: { created_at: 'asc' },
                select: {
                  id: true,
                  body: true,
                  created_at: true,
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
                  commentLikes: {
                    where: {
                      userId: user_id,
                    },
                  },
                },
              },
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
        type: murmuration.type,
        title: murmuration.title,
        text: murmuration.text,
        media: {
          image: murmuration.image,
          audio: murmuration.audio,
        },
        createdAt: murmuration.created_at,
        updatedAt: murmuration.updated_at,
        user: murmuration.user,
        stats: {
          likes: murmuration._count.murmurationLikes,
          comments: murmuration._count.comments,
        },
        isLiked: murmuration.murmurationLikes.length > 0,
        comments: murmuration.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.created_at,
          user: comment.user,
          stats: {
            likes: comment._count.commentLikes,
            replies: comment._count.comments,
          },
          isLiked: comment.commentLikes.length > 0,
          replies: comment.comments.map((reply) => ({
            id: reply.id,
            body: reply.body,
            createdAt: reply.created_at,
            user: reply.user,
            stats: {
              likes: reply._count.commentLikes,
              replies: reply._count.comments,
            },
            isLiked: reply.commentLikes.length > 0,
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

  async remove(id: string, userId: string) {
    const ifDeleted = await this.prisma.murmuration.delete({
      where: {
        id: id,
        user_id: userId,
      },
      include: {
        comments: true,
      },
    });
    if (!ifDeleted) {
      return {
        success: false,
        message:
          'murmuration was not found or you do not have proper access to delete it',
      };
    }
    return {
      success: true,
      message: 'Murmuration deleted Successfully',
    };
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
    } catch (error) {
      console.log(error);
    }
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
