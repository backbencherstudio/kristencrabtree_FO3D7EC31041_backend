import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { 
  ApiOperation,    
  ApiBearerAuth,   
} from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @UseGuards(JwtAuthGuard) 
  create(@Body() createQuoteDto: CreateQuoteDto, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.create(userID, createQuoteDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any) {
    const userId = req.user?.userId;
    return this.quotesService.findAll(userId);
  }

  @Get('random')
  @UseGuards(JwtAuthGuard)
  findRandom(@Req() req: any) {
    const userId = req.user.userId;
    return this.quotesService.getRandomAdminQuote(userId);
  }

  @Get('share/:id')
  @ApiOperation({ summary: 'Public share page for quotes' })
  async shareQuote(
    @Param('id') quoteId: string,
    @Res() res: Response,
  ) {
    const quote = await this.quotesService.getQuoteForShare(quoteId);

    if (!quote) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote Not Found</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: #f5f5f5;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                h1 { font-size: 48px; color: #333; margin-bottom: 10px; }
                p { font-size: 18px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>Quote not found or has been removed.</p>
            </div>
        </body>
        </html>
      `);
    }

    return res.send(this.quotesService.generateSharePage(quote));
  }

  @Get(':id/share-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shareable link for a quote' })
  async getShareLink(@Param('id') quoteId: string) {
    const quote = await this.quotesService.getQuoteForShare(quoteId);

    if (!quote) {
      return {
        success: false,
        message: 'Quote not found',
      };
    }

    const shareLink = this.quotesService.generateShareLink(quoteId);

    return {
      success: true,
      data: {
        shareLink,
        message: 'Share this link with your friends!',
      },
    };
  }


  @Get(':id')
  @UseGuards(JwtAuthGuard) 
  findOne(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.findOne(id, userID);
  }

  @Post('addRemoveReact/:id')
  @UseGuards(JwtAuthGuard) 
  addReaction(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.reactToggle(id, userID);
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard)  
  updateQuote(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.updateQuote(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.remove(id, userID);
  }
}
