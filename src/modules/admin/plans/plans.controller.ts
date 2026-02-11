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
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // @Post()
  // create(@Body() createPlanDto: CreatePlanDto) {
  //   return this.plansService.create(createPlanDto);
  // }

  @Get()
  async findAll() {
    return this.plansService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(
    @Body() body: { planId: string; confirmed?: boolean },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const { planId, confirmed } = body;

    return this.plansService.checkoutSession(userId, planId, confirmed);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.plansService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
  //   return this.plansService.update(+id, updatePlanDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.plansService.remove(+id);
  // }
}
