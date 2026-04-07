import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import { DigsService } from './digs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('digs')
export class DigsController {
  constructor(private readonly digsService: DigsService) {}

  // ── GET RANDOM DIG ──────────────────────────────────────────────────────
  // GET /digs/getRandomDig
  // GET /digs/getRandomDig?searchTerm=fear
  @UseGuards(JwtAuthGuard)
  @Get('getRandomDig')
  async getRandomDig(@Req() req: any, @Query('searchTerm') search?: string) {
    const userId = req.user.userId;
    return await this.digsService.getRandom(userId, search);
  }

  // ── GET SINGLE DIG WITH LAYERS ──────────────────────────────────────────
  // GET /digs/:digId
  @UseGuards(JwtAuthGuard)
  @Get(':digId')
  async getDig(@Req() req: any, @Param('digId') digId: string) {
    const userId = req.user.userId;
    return await this.digsService.getDigWithProgress(userId, digId);
  }

  // ── START A DIG ─────────────────────────────────────────────────────────
  // POST /digs/:digId/start
  @UseGuards(JwtAuthGuard)
  @Post(':digId/start')
  async startDig(@Req() req: any, @Param('digId') digId: string) {
    const userId = req.user.userId;
    return await this.digsService.startDig(userId, digId);
  }

  // ── SAVE LAYER RESPONSE (pause/resume supported) ─────────────────────────
  // POST /digs/:digId/layers/:layerId/respond
  // Body: { response: "My answer here" }
  @UseGuards(JwtAuthGuard)
  @Post(':digId/layers/:layerId/respond')
  async saveLayerResponse(
    @Req() req: any,
    @Param('digId') digId: string,
    @Param('layerId') layerId: string,
    @Body() body: { response: string },
  ) {
    const userId = req.user.userId;
    return await this.digsService.saveLayerResponse(
      userId,
      digId,
      layerId,
      body.response,
    );
  }

  // ── GET ALL RESPONSES FOR A DIG ──────────────────────────────────────────
  // GET /digs/:digId/responses
  @UseGuards(JwtAuthGuard)
  @Get(':digId/responses')
  async getDigResponses(@Req() req: any, @Param('digId') digId: string) {
    const userId = req.user.userId;
    return await this.digsService.getDigResponses(userId, digId);
  }

  // ── MARK DIG COMPLETE ────────────────────────────────────────────────────
  // POST /digs/complete/:digId
  @UseGuards(JwtAuthGuard)
  @Post('complete/:digId')
  async markComplete(@Req() req: any, @Param('digId') digId: string) {
    const userId = req.user.userId;
    return await this.digsService.markDigComplete(userId, digId);
  }

  // ── GET DIG PROGRESS ─────────────────────────────────────────────────────
  // GET /digs/progress
  @UseGuards(JwtAuthGuard)
  @Get('progress')
  async getProgress(@Req() req: any) {
    const userId = req.user.userId;
    return await this.digsService.getDigProgress(userId);
  }

  // ── GET USER XP ──────────────────────────────────────────────────────────
  // GET /digs/xp
  @UseGuards(JwtAuthGuard)
  @Get('xp')
  async getUserXp(@Req() req: any) {
    const userId = req.user.userId;
    return await this.digsService.getUserXp(userId);
  }
}
