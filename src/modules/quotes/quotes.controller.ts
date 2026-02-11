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
  findAll(@Req() req:any) {
    const userId = req.user?.userId;
    return this.quotesService.findAll(userId);
  }

  @Get('random')
  findRandom(
    @Req() req:any,
  ){
    const userId = req.user.userId;
    return this.quotesService.getRandomAdminQuote(userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.findOne(id, userID);
  }

  @Post('addRemoveReact/:id')
  addReaction(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.reactToggle(id, userID);
  }

  @Patch('update/:id')
  updateQuote(@Param('id') id:string,@Body() dto:UpdateQuoteDto){
    return this.quotesService.updateQuote(id,dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userID = req.user?.userId;
    return this.quotesService.remove(id, userID);
  }
}
