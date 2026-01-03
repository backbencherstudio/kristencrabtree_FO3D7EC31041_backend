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
} from '@nestjs/common';
import { DigsService } from './digs.service';
import { CreateDigDto, SaveResponseDto } from './dto/create-dig.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';

@Controller('admin/digs')
export class DigsController {
  constructor(private readonly digsService: DigsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createDigDto: CreateDigDto, @Req() req: any) {
    const userId = req.user?.userId;
    return this.digsService.create(userId, createDigDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('points')
  getPoints(@Req() req: any) {
    const userId = req.user?.userId;
    return this.digsService.getPointsdict(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('response/:digId')
  respondToDig(
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
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.digsService.getSingleDig(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    const userId = req.user?.userId;
    return this.digsService.getAlldigs(userId);
  }
}
