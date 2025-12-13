import { Injectable } from '@nestjs/common';
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
  async findAll(user_id: string) {
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

      const quotes = await this.prisma.quote.findMany({
        where: { user_id },
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
        where: { id, user_id },
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
}
