import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  UploadedFiles,
} from '@nestjs/common';
import { MurmurationService } from './murmuration.service';
import { CreateMurmurationDto } from './dto/create-murmuration.dto';
import { UpdateMurmurationDto } from './dto/update-murmuration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';

@Controller('murmuration')
export class MurmurationController {
  constructor(private readonly murmurationService: MurmurationService) {}

  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        limits: { fileSize: 12 * 1024 * 1024 },
      },
    ),
  )
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateMurmurationDto,
    @UploadedFiles()
    files: {
      audio?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    return this.murmurationService.create(
      req.user.userId,
      dto,
      files?.audio?.[0],
      files?.image?.[0],
    );
  }

  @Get()
  findAll() {
    return this.murmurationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.murmurationService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('likeUnlikeM/:id')
  likeMurmuration(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.murmurationService.toggleLikeForMurmuration(user_id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('likeUnlikeC/:id')
  likeComment(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return this.murmurationService.toggleLikeForComment(user_id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('comment/:id')
  addComment(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const user_id = req.user?.userId;
    return this.murmurationService.addComment(user_id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.murmurationService.remove(id);
  }
}
