import { Injectable } from '@nestjs/common';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ContentManagementService {
  constructor(private readonly prisma: PrismaService) {}
  create(createContentManagementDto: CreateContentManagementDto) {
    return 'This action adds a new contentManagement';
  }

  async findAll(userId: string) {
    try {
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

  findOne(id: number) {
    return `This action returns a #${id} contentManagement`;
  }

  update(id: number, updateContentManagementDto: UpdateContentManagementDto) {
    return `This action updates a #${id} contentManagement`;
  }

  remove(id: number) {
    return `This action removes a #${id} contentManagement`;
  }
}
