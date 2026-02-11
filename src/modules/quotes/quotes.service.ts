import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}
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
      const total = await this.prisma.quote.count({
        where: {
          user: {
            type: 'admin',
          },
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
          user: {
            type: 'admin',
          },
        },
        orderBy: {
          created_at: 'asc',
        },
        skip: randomIndex,
        take: 1,
      });

      return {
        success: true,
        message: 'Random admin quote retrieved',
        data: quote,
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
