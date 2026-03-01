import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DigsService } from './digs.service';
// import { CreateDigDto } from './dto/create-dig.dto';
// import { UpdateDigDto } from './dto/update-dig.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('digs')
export class DigsController {
  constructor(private readonly digsService: DigsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('getRandomDig')
  async getRandomDig(@Req() req: any) {
    const userId = req.user.userId;
    return await this.digsService.getRandom(userId);
  }
}
