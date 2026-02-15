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
  UseInterceptors,
  UploadedFile,
  Put,
  Query,
} from '@nestjs/common';
import { ContentManagementService } from './content_management.service';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from 'src/common/pagination/paginatio.dto';

@Controller('admin/content-management')
export class ContentManagementController {
  constructor(
    private readonly contentManagementService: ContentManagementService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @Post('medi')
  @UseInterceptors(FileInterceptor('audio'))
  async create(
    @UploadedFile() audio: Express.Multer.File,
    @Body() CreateContentManagementDto: CreateContentManagementDto,
    @Req() req: any,
  ) {
    try {
      const user_id = req.user?.userId;
      return this.contentManagementService.create(
        user_id,
        CreateContentManagementDto,
        audio,
      );
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create journel',
        error: error.message || error,
      };
    }
  }


  @UseGuards(JwtAuthGuard)
  @Get('allqoutes')
  findAll(@Req() req: any,@Query() pagintionDto:PaginationDto) {
    const userId = req.user.userId;
    if (userId === null) {
      return {
        success: false,
        message: 'user id is missing',
      };
    }
    return this.contentManagementService.findAllQoutes(userId, pagintionDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('meditations')
  findAllM(@Req() req: any,@Query() pagintionDto:PaginationDto) {
    const userId = req.user?.userId;
    return this.contentManagementService.findAllMeditations(userId,pagintionDto);
  }

   // @UseGuards(JwtAuthGuard)
  @Get('medi/:id')
  async getSingleMeditation(@Param('id') id:string){
    return await this.contentManagementService.getOneMeditation(id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorite-meditations')
  getFavoriteMeditations(@Req() req: any) {
    const userId = req.user?.userId;
    return this.contentManagementService.getFavoriteMeditations(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('status/:id')
  updateqouteStatus(@Param('id') id: string, @Req() req: any) {
    const qouteId = id;
    const userId = req.user?.userId;
    return this.contentManagementService.updateQuoteStatus(userId, qouteId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addlistener/:meditation_id')
  async addListener(@Param('meditation_id') meditation_id: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.contentManagementService.addListener(userId, meditation_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addfavorite/:meditation_id')
  async addFavorite(@Param('meditation_id') meditation_id: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.contentManagementService.addFavoriteMeditation(userId, meditation_id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('medi/:meditation_id')
  @UseInterceptors(FileInterceptor('audio'))
  async update(
    @Param('meditation_id') meditation_id: string,
    @UploadedFile() audio: Express.Multer.File,
    @Body() updateContentManagementDto: CreateContentManagementDto,
    @Req() req: any,
  ) {
    try {
      const user_id = req.user?.userId;
      return this.contentManagementService.update(
        user_id,
        meditation_id,
        updateContentManagementDto,
        audio,
      );
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update meditation',
        error: error.message || error,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('medi/:id')
  remove(@Param('id') id: string, @Req() req:any) {
    const userId = req.user.userId;
    return this.contentManagementService.remove(userId,id);
  }
}
