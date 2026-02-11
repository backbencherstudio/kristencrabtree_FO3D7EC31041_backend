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
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/pagination/paginatio.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  create(@Body() createDashboardDto: CreateDashboardDto) {
    return this.dashboardService.create(createDashboardDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats/:timeframe')
  async findAll(
    @Param('timeframe') timeframe: 'last_7_days' | 'this_month' | 'last_month',
  ) {
    return this.dashboardService.stats(timeframe);
  }

  @Get('overview')
  async overview() {
    return this.dashboardService.overview();
  }

  @Get('payment-overview')
  async paymentOverview(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
    @Query('planName') planName?: string,
    @Query('status') status?: string,
  ) {
    return this.dashboardService.paymentOverview(
      { page,perPage },
      { planName, status },
    );
  }

  @Get('payment-stats')
  async paymentStats(){
    return this.dashboardService.paymentStats();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDashboardDto: UpdateDashboardDto,
  ) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
