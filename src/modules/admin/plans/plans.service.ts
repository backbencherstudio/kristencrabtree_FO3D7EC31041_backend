import { Injectable } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}
  async createPlans (createPlanDto: CreatePlanDto) {
   try {
    
    const plan = await this.prisma.plans.create({
   //   data: {...createPlanDto}
    })
   
    return{
      status: 'success',
      message: 'Plan created successfully',
      data: plan
    }

   } catch (error) {
    
   }
  }

  findAll() {
    return `This action returns all plans`;
  }

  findOne(id: number) {
    return `This action returns a #${id} plan`;
  }

  update(id: number, updatePlanDto: UpdatePlanDto) {
    return `This action updates a #${id} plan`;
  }

  remove(id: number) {
    return `This action removes a #${id} plan`;
  }
}
