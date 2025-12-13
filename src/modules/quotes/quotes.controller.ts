import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { use } from 'passport';

@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Body() createQuoteDto: CreateQuoteDto, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.create(userID, createQuoteDto);
  }

  @Get()
  findAll(@Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.findAll(userID);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.findOne(id , userID);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.remove(id, userID);
  }
}
