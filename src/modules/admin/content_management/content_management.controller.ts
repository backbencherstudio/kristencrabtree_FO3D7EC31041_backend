import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { ContentManagementService } from './content_management.service';
import { CreateContentManagementDto } from './dto/create-content_management.dto';
import { UpdateContentManagementDto } from './dto/update-content_management.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller('admin/content-management')
export class ContentManagementController {
  constructor(private readonly contentManagementService: ContentManagementService) {}

  @Post()
  create(@Body() createContentManagementDto: CreateContentManagementDto) {
    return this.contentManagementService.create(createContentManagementDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req:any 
  ) {
    const userId = req.user.userId;
    return this.contentManagementService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentManagementService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContentManagementDto: UpdateContentManagementDto) {
    return this.contentManagementService.update(+id, updateContentManagementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentManagementService.remove(+id);
  }
}
