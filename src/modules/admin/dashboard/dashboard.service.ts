import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  getMonthRange,
  getLastNDaysRange,
  formatPercentageChange,
  getMonthRangeByYear,
  isPremiumUser,
} from './helper.utils';
import { PaginationDto } from 'src/common/pagination/paginatio.dto';

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

    const percentage = formatPercentageChange(lastMonthRev, thisMonthRev, 2);

    console.log(thisMonthRev, lastMonthRev);

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

  async overview() {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const lastYear = currentYear - 1;

    const [currentYearData, lastYearData] = await Promise.all([
      this.getMonthlyOverview(currentYear),
      this.getMonthlyOverview(lastYear),
    ]);

    return {
      success: true,
      data: {
        currentYear: currentYearData,
        lastYear: lastYearData,
      },
    };
  }

  private async getMonthlyOverview(year: number) {
    const results = [];
    const MONTHS = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    for (let month = 0; month < 12; month++) {
      const { start, end } = getMonthRangeByYear(year, month);

      const [users, subscriptions, revenueAgg] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            type: 'user',
            created_at: { gte: start, lte: end },
          },
          select: {
            subscriptionValidUntil: true,
          },
        }),

        this.prisma.userSubscription.count({
          where: {
            status: 'active',
            created_at: { gte: start, lte: end },
          },
        }),

        this.prisma.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            status: 'succeeded',
            created_at: { gte: start, lte: end },
          },
        }),
      ]);

      // Split users into free vs premium
      let premiumUsers = 0;
      let freeUsers = 0;

      for (const user of users) {
        if (isPremiumUser(user.subscriptionValidUntil)) {
          premiumUsers++;
        } else {
          freeUsers++;
        }
      }

      results.push({
        month: MONTHS[month],
        users: users.length,
        premiumUsers,
        freeUsers,
        activeSubscriptions: subscriptions,
        revenue: Number(revenueAgg._sum.amount ?? 0),
      });
    }

    return results;
  }

  async paymentOverview(
    paginationDto: { page?: number; perPage?: number },
    filters: { planName?: string; status?: string },
  ) {
    const whereClause: any = {};

    if (filters.planName) {
      whereClause.planName = {
        equals: filters.planName,
        mode: 'insensitive',
      };
    }

    if (filters.status) {
      whereClause.status = {
        equals: filters.status,
        mode: 'insensitive',
      };
    }

    const page =
      Number(paginationDto?.page) > 0 ? Number(paginationDto.page) : 1;
    const limit =
      Number(paginationDto?.perPage) > 0 ? Number(paginationDto.perPage) : 10;

    const skip = (page - 1) * limit;

    const [total, subscriptions] = await this.prisma.$transaction([
      this.prisma.userSubscription.count({
        where: whereClause,
      }),
      this.prisma.userSubscription.findMany({
        select: {
          planName: true,
          status: true,
          updated_at: true,
          cardLast4: true,
          user: {
            select: {
              email: true,
              first_name: true,
            },
          },
        },
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          updated_at: 'desc',
        },
      }),
    ]);

    return {
      success: true,
      data: subscriptions,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async paymentStats() {
    const Revenue = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'succeeded',
      },
    });
    const totalRevenue = Revenue._sum.amount || 0;

    //yearly revenue
    const yearlySubs = await this.prisma.userSubscription.findMany({
      where: {
        status: 'active',
        planName: 'Yearly',
      },
      select: {
        paymentTransactions: {
          where: {
            status: 'succeeded', // VERY IMPORTANT
          },
          select: {
            amount: true,
          },
        },
      },
    });

    let yearlyRevenue = 0;
    for (const sub of yearlySubs) {
      for (const tx of sub.paymentTransactions) {
        yearlyRevenue += Number(tx.amount ?? 0);
      }
    }

    //monthly revenue
    const monthlySubs = await this.prisma.userSubscription.findMany({
      where: {
        status: 'active',
        planName: 'Monthly',
      },
      select: {
        paymentTransactions: {
          where: {
            status: 'succeeded', // VERY IMPORTANT
          },
          select: {
            amount: true,
          },
        },
      },
    });

    let monthlyRevenue = 0;
    for (const sub of monthlySubs) {
      for (const tx of sub.paymentTransactions) {
        monthlyRevenue += Number(tx.amount ?? 0);
      }
    }

    const digs = await this.prisma.digs.findMany({
      orderBy:{
        answeredCount:'desc'
      },
      take:5
    })
    

    return {
      success: true,
      data: {
        total: {
          text:"Total Reveneau",
          value: totalRevenue.toString(),
        },
        yearly: {
          text: "Yearly Revenue",
          value: yearlyRevenue.toString(),
        },
        monthly: {
          text: "Monthly Revenue",
          value: monthlyRevenue.toString(),
        },
        topDigs:{
          text:"Top Active Exercises",
          digs:digs.map(dig=>({
          id:dig.id,
          title:dig.title,
          type:dig.type
        }))
        }
      },
    };
  }
  async topdigs(){
    
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
