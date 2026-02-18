import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { count } from 'console';
import { SubscriptionManager } from 'src/common/helper/subscription.manager';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}
  async create(user_id: string, createQuoteDto: CreateQuoteDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      const newQuote = await this.prisma.quote.create({
        data: {
          ...createQuoteDto,
          user_id,
          type: { set: createQuoteDto.type },
        },
      });
      return {
        success: true,
        message: 'Quote created successfully',
        data: newQuote,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create quote',
        error: error.message || error,
      };
    }
  }
  async findAll(userId) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      const quotes = await this.prisma.quote.findMany({
        where: { user_id: userId },
      });

      if (quotes.length === 0) {
        return {
          success: true,
          message: 'No quotes found, please create one',
          data: [],
        };
      }
      quotes.map((quote) => {
        quote['reactions'] = this.prisma.quoteReaction.count({
          where: {
            qouteId: quote.id,
          },
        });
      });
      return {
        success: true,
        message: 'Quotes retrieved successfully',
        data: quotes,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch quotes',
        error: error.message || error,
      };
    }
  }
  async findOne(id: string, user_id: string) {
    try {
      const quote = await this.prisma.quote.findFirst({
        where: { id },
        select: {
          id: true,
          quote_author: true,
          quote_text: true,
          reason: true,
          created_at: true,
        },
      });

      if (!quote) {
        return {
          success: false,
          message: 'Quote not found or deleted',
        };
      }

      return {
        success: true,
        message: 'Quote retrieved successfully',
        data: quote,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve quote',
        error: error.message || error,
      };
    }
  }
  async updateQuote(id, dto) {
    console.log(id);
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: id,
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    const updated = await this.prisma.quote.update({
      where: {
        id: id,
      },
      data: {
        ...dto,
      },
    });
    return {
      success: true,
      message: 'Updated Success',
    };
  }
  async remove(id: string, user_id: string) {
    try {
      const quote = await this.prisma.quote.findFirst({
        where: { id, user_id },
      });

      if (!quote) {
        return {
          success: false,
          message: 'Quote not found or already deleted',
        };
      }

      const deletedQuote = await this.prisma.quote.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Quote deleted successfully',
        data: deletedQuote,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete quote',
        error: error.message || error,
      };
    }
  }
  async reactToggle(quoteId: string, userId: string) {
    try {
      // Check if the user is valid
      const validUser = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!validUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const adminQuote = await this.prisma.quote.findUnique({
        where: { id: quoteId, status: true },
        include: {
          user: {
            select: {
              id: true,
              type: true,
            },
          },
        },
      });

      if (!adminQuote || adminQuote.user.type !== 'admin') {
        return {
          success: false,
          message: 'Only admin quotes can be reacted to',
        };
      }

      const existingReaction = await this.prisma.quoteReaction.findUnique({
        where: {
          userId_qouteId: {
            userId: userId,
            qouteId: quoteId,
          },
        },
      });

      if (existingReaction) {
        await this.prisma.quoteReaction.delete({
          where: {
            userId_qouteId: {
              userId: userId,
              qouteId: quoteId,
            },
          },
        });

        return {
          success: true,
          message: 'Reaction removed successfully',
        };
      } else {
        await this.prisma.quoteReaction.create({
          data: {
            userId: userId,
            qouteId: quoteId,
          },
        });

        return {
          success: true,
          message: 'Reaction added successfully',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while processing the request',
        error: error.message,
      };
    }
  }
  async getRandomAdminQuote(userId: string) {
    try {
      const userPlan = await SubscriptionManager(this.prisma, userId);

      // For free users, check Redis cache first
      if (userPlan.subscriptionName === 'free') {
        const cachedRaw = await this.redis.get(`quote:daily:${userId}`);

        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          return {
            success: true,
            message: 'Random admin quote retrieved',
            data: cached,
          };
        }
      }

      const total = await this.prisma.quote.count({
        where: {
          user: { type: 'admin' },
        },
      });

      if (total === 0) {
        return {
          success: true,
          message: 'No admin quotes found',
          data: null,
        };
      }

      const randomIndex = Math.floor(Math.random() * total);

      const quote = await this.prisma.quote.findFirst({
        where: {
          user: { type: 'admin' },
          type: {
            hasSome: userPlan.focus_area, 
          },
        },
        orderBy: { created_at: 'asc' },
        skip: randomIndex,
        take: 1,
      });

      const favourite = await this.prisma.quoteReaction.findFirst({
        where: {
          userId: userId,
          qouteId: quote.id,
        },
      });

      const quoteWithMeta = {
        ...quote,
        isFavourite: !!favourite,
      };

      // Cache the quote for free users until midnight (so it resets daily)
      if (userPlan.subscriptionName === 'free') {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0); // next midnight
        const secondsUntilMidnight = Math.floor(
          (midnight.getTime() - now.getTime()) / 1000,
        );

        await this.redis.set(
          `quote:daily:${userId}`,
          JSON.stringify(quoteWithMeta),
          'EX',
          secondsUntilMidnight,
        );
      }

      return {
        success: true,
        message: 'Random admin quote retrieved',
        data: quoteWithMeta,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch random quote',
        error: error.message || error,
      };
    }
  }
}
