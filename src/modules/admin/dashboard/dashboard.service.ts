import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  getMonthRange,
  getLastNDaysRange,
  formatPercentageChange,
} from './helper.utils';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  create(createDashboardDto: CreateDashboardDto) {
    return 'This action adds a new dashboard';
  }

  async stats(timeframe: 'last_7_days' | 'this_month' | 'last_month') {
    let range: { start: string; end: string };
    let label: string;

    switch (timeframe) {
      case 'last_7_days':
        range = getLastNDaysRange(-7);
        label = 'Last 7 days';
        break;

      case 'this_month':
        range = getMonthRange(0);
        label = 'This month';
        break;

      case 'last_month':
        range = getMonthRange(-1);
        label = 'Last month';
        break;

      default:
        throw new BadRequestException('Invalid timeframe');
    }

    const { start, end } = range;

    // ───────── USERS ─────────
    const totalUser = await this.prisma.user.count({
      where: {
        type: 'user',
        created_at: {
          gte: start,
          lte: end,
        },
      },
    });

    // ───────── SUBSCRIPTIONS ─────────
    const activeSubscriptions = await this.prisma.userSubscription.count({
      where: {
        status: 'active',
        created_at: {
          gte: start,
          lte: end,
        },
      },
    });

    // ───────── REVENUE ─────────
    const revenueAgg = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'succeeded',
        created_at: { gte: start, lte: end },
      },
    });

    const totalRevenue = Number(revenueAgg._sum.amount ?? 0);

    const thisMonthR = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'succeeded',
        created_at: { gte: getMonthRange(0).start, lte: getMonthRange(0).end },
      },
    });

    const lastMonthR = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'succeeded',
        created_at: {
          gte: getMonthRange(-1).start,
          lte: getMonthRange(-1).end,
        },
      },
    });

    const thisMonthRev = Number(thisMonthR._sum.amount ?? 0);
    const lastMonthRev = Number(lastMonthR._sum.amount ?? 0);

    const percentage = formatPercentageChange(lastMonthRev,thisMonthRev,2);

    console.log(thisMonthRev, lastMonthR);

    return {
      success: true,
      data: {
        timeframe,
        label,
        range: {
          start,
          end,
        },
        metrics: {
          totalUsers: totalUser,
          activeSubscriptions,
          revenue: totalRevenue,
          totalRevPercentage: percentage,
        },
      },
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }

  update(id: number, updateDashboardDto: UpdateDashboardDto) {
    return `This action updates a #${id} dashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }
}
