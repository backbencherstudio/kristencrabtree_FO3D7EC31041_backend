import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { DigsService } from './digs.service';
import { CreateDigDto, SaveResponseDto } from './dto/create-dig.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { UpdateDigDto } from './dto/update-dig.dto';
import { PaginationDto } from 'src/common/pagination/paginatio.dto';

@Controller('admin/digs')
export class DigsController {
  constructor(private readonly digsService: DigsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createDigDto: CreateDigDto, @Req() req: any) {
    const userId = req.user?.userId;
    return this.digsService.create(userId, createDigDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('points')
  async getPoints(@Req() req: any) {
    const userId = req.user?.userId;
    return this.digsService.getPointsdict(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('response/:digId')
  async respondToDig(
    @Param('digId') digId: string,
    @Req() req: any,
    @Body() body: SaveResponseDto,
  ) {
    const userId = req.user?.userId;

    if (!body.answers || !Array.isArray(body.answers)) {
      throw new BadRequestException('Answers must be provided as an array');
    }

    return this.digsService.saveUserResponses(userId, digId, body.answers);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.digsService.getSingleDig(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: any,@Query() paginationDto:PaginationDto) {
    const userId = req.user?.userId;
    return this.digsService.getAlldigs(userId,paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update/:id')
  async updateDig(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateDig: UpdateDigDto,
  ) {
    const userId = req.user.userId;
    return await this.digsService.updateDig(id, userId, updateDig);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete/:id')
  async deleteDig(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.digsService.deleteDig(id, userId);
  }
}
