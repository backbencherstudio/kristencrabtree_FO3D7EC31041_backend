import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { JournelsService } from './journels.service';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('journels')
export class JournelsController {
  constructor(private readonly journelsService: JournelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('audio'))
  async create(
    @UploadedFile() audio: Express.Multer.File,
    @Body() createJournelDto: CreateJournelDto,
    @Req() req: any,
  ) {
    try {
      const user_id = req.user?.userId;
      return this.journelsService.create(user_id, createJournelDto, audio);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create journel',
        error: error.message || error,
      };
    }
  }
  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll(@Req() req:any) {
    return this.journelsService.findAll(req.user.userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('reccommended')
  getRecommendedJournals(@Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.getRecommendedJournals(user_id);
  }
  @UseGuards(JwtAuthGuard)
  @Get('my-journals')
  getMyJournals(@Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.getPersonalJournals(user_id);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.findOne(user_id, id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('likeUnlike/:id')
  likeJournel(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.toggleLike(user_id, id);
  }
  @Patch('update/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  update(
    @Param('id') id: string,
    @Body() updateJournelDto: UpdateJournelDto,
    @Req() req: any,
    @UploadedFile() audio?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    return this.journelsService.update(user_id, id, updateJournelDto, audio);
  }
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.remove(user_id, id);
  }
}
