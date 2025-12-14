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
import { UserPageService } from './user_page.service';
import { CreateUserPageDto } from './dto/create-user_page.dto';
import { UpdateUserPageDto } from './dto/update-user_page.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('user-page')
export class UserPageController {
  constructor(private readonly userPageService: UserPageService) {}

  @Post()
  create(@Body() createUserPageDto: CreateUserPageDto) {
    return this.userPageService.create(createUserPageDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.userPageService.findAll(req.user?.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userPageService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserPageDto: UpdateUserPageDto,
  ) {
    return this.userPageService.update(+id, updateUserPageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userPageService.remove(+id);
  }
}
