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
} from '@nestjs/common';
import { ContentManagementService } from './content_management.service';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

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
  findAll(@Req() req: any) {
    const userId = req.user.userId;
    if (userId === null) {
      return {
        success: false,
        message: 'user id is missing',
      };
    }
    return this.contentManagementService.findAllQoutes(userId);
  }

  @Get('meditaions')
  findAllM() {
    return this.contentManagementService.findAllMeditations();
  }

  @UseGuards(JwtAuthGuard)
  @Post('status/:id')
  updateqouteStatus(@Param('id') id: string, @Req() req: any) {
    const qouteId = id;
    const userId = req.user?.userId;
    return this.contentManagementService.updateQuoteStatus(userId, qouteId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('medi/:meditation_id')
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
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req:any) {
    const userId = req.user.userId;
    return this.contentManagementService.remove(userId,id);
  }
}
