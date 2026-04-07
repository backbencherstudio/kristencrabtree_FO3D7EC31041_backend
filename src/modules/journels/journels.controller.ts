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
  UploadedFiles,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JournelsService } from './journels.service';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/pagination/paginatio.dto';

@Controller('journels')
export class JournelsController {
  constructor(private readonly journelsService: JournelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'photos', maxCount: 10 }, // ✅ up to 10 photos
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
      },
    ),
  )
  async create(
    @UploadedFiles()
    files: {
      audio?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
    @Body() createJournelDto: CreateJournelDto,
    @Req() req: any,
  ) {
    const user_id = req.user?.userId;
    const audio = files?.audio?.[0];
    const photos = files?.photos || [];
    return this.journelsService.create(
      user_id,
      createJournelDto,
      audio,
      photos,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll(@Req() req: any, @Query() paginationDto: PaginationDto) {
    const userId = req.user?.userId;
    return this.journelsService.findAll(userId, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  getRecommendedJournals(@Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.getRecommendedJournals(user_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-journals')
  getMyJournals(@Req() req: any, @Query('searchTerm') searchTerm?: string) {
    const user_id = req.user?.userId;
    return this.journelsService.getPersonalJournals(user_id, searchTerm);
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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'photos', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 },
      },
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() updateJournelDto: UpdateJournelDto,
    @Req() req: any,
    @UploadedFiles()
    files?: {
      audio?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
  ) {
    const user_id = req.user?.userId;
    const audio = files?.audio?.[0];
    const photos = files?.photos || [];
    return this.journelsService.update(
      user_id,
      id,
      updateJournelDto,
      audio,
      photos,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.journelsService.remove(user_id, id);
  }
}
