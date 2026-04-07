import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { PrismaService } from '../../prisma/prisma.service';
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
          type: createQuoteDto.type ?? [],
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
        error: (error as Error).message || error,
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
        error: (error as Error).message || error,
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
        error: (error as Error).message || error,
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
        error: (error as Error).message || error,
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
        error: (error as Error).message,
      };
    }
  }
  async getRandomAdminQuote(userId: string) {
    try {
      // ── Get total count of all quotes ─────────────────────────
      const total = await this.prisma.quote.count({
        where: {
          deleted_at: null,
          status: true,
        },
      });

      if (total === 0) {
        return {
          success: true,
          message: 'No quotes found',
          data: [],
        };
      }

      // ── Fetch all quotes ──────────────────────────────────────
      const allQuotes = await this.prisma.quote.findMany({
        where: {
          deleted_at: null,
          status: true,
        },
      });

      // ── Shuffle and pick 5 random quotes ─────────────────────
      const shuffled = allQuotes.sort(() => Math.random() - 0.5);
      const randomFive = shuffled.slice(0, Math.min(5, shuffled.length));

      // ── Attach isFavourite + shareLink to each ────────────────
      const quotesWithMeta = await Promise.all(
        randomFive.map(async (quote) => {
          const favourite = await this.prisma.quoteReaction.findFirst({
            where: {
              userId: userId,
              qouteId: quote.id,
            },
          });

          return {
            ...quote,
            isFavourite: !!favourite,
            shareLink: this.generateShareLink(quote.id),
          };
        }),
      );

      return {
        success: true,
        message: 'Random quotes retrieved',
        data: quotesWithMeta,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch random quotes',
        error: (error as Error).message || error,
      };
    }
  }
  async getQuoteForShare(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quote_text: true,
        quote_author: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return quote;
  }

  // Generate share link
  generateShareLink(quoteId: string): string {
    return `${process.env.APP_URL}/quotes/share/${quoteId}`;
  }

  // Generate HTML page for sharing
  generateSharePage(quote: any): string {
    const deepLink = `yourapp://quote/${quote.id}`;
    const webUrl = `${process.env.APP_URL}/quotes/share/${quote.id}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(quote.quote_author || 'Quote')}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${webUrl}">
    <meta property="og:title" content="Quote by ${this.escapeHtml(quote.quote_author || 'Anonymous')}">
    <meta property="og:description" content="${this.escapeHtml(quote.quote_text)}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${webUrl}">
    <meta property="twitter:title" content="Quote by ${this.escapeHtml(quote.quote_author || 'Anonymous')}">
    <meta property="twitter:description" content="${this.escapeHtml(quote.quote_text)}">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            text-align: center;
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .quote-text {
            font-size: 24px;
            line-height: 1.6;
            color: #333;
            margin-bottom: 20px;
            font-style: italic;
        }
        .quote-author {
            font-size: 18px;
            color: #666;
            margin-bottom: 30px;
        }
        .shared-by {
            font-size: 14px;
            color: #999;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            margin: 10px;
            transition: transform 0.2s;
            cursor: pointer;
            border: none;
            font-size: 16px;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .btn-secondary {
            background: #34d399;
        }
        .loader {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
            display: none;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status { font-size: 14px; color: #666; margin-top: 20px; }
        #downloadSection { display: none; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="quote-text">"${this.escapeHtml(quote.quote_text)}"</div>
        <div class="quote-author">— ${this.escapeHtml(quote.quote_author || 'Anonymous')}</div>
        ${quote.user ? `<div class="shared-by">Shared by ${this.escapeHtml(quote.user.first_name)} ${this.escapeHtml(quote.user.last_name || '')}</div>` : ''}
        
        <button onclick="openApp()" class="btn" id="openBtn">
            Open in App
        </button>
        
        <div class="loader" id="loader"></div>
        <div class="status" id="status"></div>
        
        <div id="downloadSection">
            <p style="margin: 20px 0; color: #666;">Don't have the app?</p>
            <a href="${process.env.ANDROID_PLAY_STORE_URL || '#'}" class="btn btn-secondary">Download on Play Store</a>
            <a href="${process.env.IOS_APP_STORE_URL || '#'}" class="btn btn-secondary">Download on App Store</a>
        </div>
    </div>
    
    <script>
        const deepLink = '${deepLink}';
        let appOpened = false;
        
        function openApp() {
            document.getElementById('loader').style.display = 'block';
            document.getElementById('status').textContent = 'Opening app...';
            
            window.location.href = deepLink;
            appOpened = true;
            
            setTimeout(() => {
                if (!document.hidden) {
                    document.getElementById('loader').style.display = 'none';
                    document.getElementById('status').textContent = '';
                    document.getElementById('downloadSection').style.display = 'block';
                }
            }, 2500);
        }
        
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /android|iphone|ipad|ipod/i.test(userAgent.toLowerCase());
        
        if (isMobile) {
            setTimeout(openApp, 500);
        }
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && appOpened) {
                console.log('App opened successfully');
            }
        });
    </script>
</body>
</html>
    `;
  }

  // Helper to escape HTML characters
  private escapeHtml(text: string): string {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
