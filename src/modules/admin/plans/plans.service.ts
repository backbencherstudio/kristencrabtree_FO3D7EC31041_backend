import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  async createPlans(createPlanDto: CreatePlanDto) {
    try {
      const plan = await this.prisma.plans.create({
        //   data: {...createPlanDto}
      });

      return {
        status: 'success',
        message: 'Plan created successfully',
        data: plan,
      };
    } catch (error) {}
  }

  async getPlans() {
    const prices = await this.stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    // return prices;
    return {
      success: true,
      data: prices.data.map((price) => ({
        id: price.id,
        name: (price.product as any).name,
        description: (price.product as any).description,
        // type:(price.recurring.interval),
        amount: price.unit_amount,
        currency: price.currency,
        interval: price?.recurring?.interval || 'Not available',
        status: price.active,
      })),
    };
  }

  findOne(id: number) {
    // const plan
  }

  async ensureCustomerForUser(userId: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          first_name: true,
          last_name: true,
          billing_id: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.billing_id) {
        // verify existing Stripe customer; recreate if missing/deleted
        try {
          const existing = (await this.stripe.customers.retrieve(
            user.billing_id,
          )) as Stripe.Customer | Stripe.DeletedCustomer;
          if (!('deleted' in existing && existing.deleted)) {
            return existing.id;
          }
        } catch (err: any) {
          if (err?.statusCode !== 404) {
            throw err;
          }
        }
      }

      if (!user.email) {
        throw new BadRequestException(
          'User email is required to create Stripe customer',
        );
      }

      const name =
        user.name ||
        [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
        user.email;

      const customer = await StripePayment.createCustomer({
        user_id: user.id,
        name,
        email: user.email,
      });

      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { billing_id: customer.id },
        select: { billing_id: true },
      });

      return updated.billing_id as string;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create Stripe customer',
      );
    }
  }

  async createSetupIntent(userId: string): Promise<string> {
    const customerId = await this.ensureCustomerForUser(userId);
    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      automatic_payment_methods: {
        enabled: true,
      },
      usage: 'off_session',
      metadata: { userId },
    });
    if (!setupIntent.client_secret) {
      throw new InternalServerErrorException('Failed to create setup intent');
    }
    return setupIntent.client_secret;
  }

  async checkoutSession(userId: string, planId: string, confirmed?: boolean) {
    const customerId = await this.ensureCustomerForUser(userId);

    // 🟢 PHASE 1 — Create SetupIntent
    if (!confirmed) {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
      });

      if (!setupIntent.client_secret) {
        throw new InternalServerErrorException('Failed to create setup intent');
      }

      return {
        step: 'SETUP_INTENT',
        clientSecret: setupIntent.client_secret,
      };
    }

    // 🟢 PHASE 2 — Create subscription AFTER card is saved
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (!paymentMethods.data.length) {
      throw new BadRequestException('No payment method found');
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
      default_payment_method: paymentMethods.data[0].id,
      collection_method: 'charge_automatically',
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;

    const paymentIntent =
      latestInvoice && typeof (latestInvoice as any).payment_intent !== 'string'
        ? ((latestInvoice as any).payment_intent as Stripe.PaymentIntent)
        : null;

    if (paymentIntent?.status === 'requires_action') {
      return {
        step: 'REQUIRES_ACTION',
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
      };
    }
    if (subscription.status === 'active') {
      await this.prisma.userSubscription.upsert({
        where: {
          userId, // requires userId to be @unique
        },
        update: {
          planName: planId, // or map to a readable plan name
          description: ['Stripe subscription'],
          allowedPermissions: ['premium'], // adapt to your app
          timesRenewed: {
            increment: 0, // stays same on first purchase
          },
        },
        create: {
          userId,
          stripeSubscriptionId: subscription.id,
          planName: planId,
          description: ['Stripe subscription'],
          allowedPermissions: ['premium'],
          timesRenewed: 0,
        },
      });
      await this.prisma.paymentTransaction.create({
        data: {
          type: 'subscription',
          provider: 'stripe',
          status: 'succeeded',
          raw_status: 'active',
          amount: subscription.items.data[0].price.unit_amount
            ? new Prisma.Decimal(
                subscription.items.data[0].price.unit_amount / 100,
              )
            : null,
          currency: subscription.items.data[0].price.currency,
          order_id:`${userId}-${planId}`,
          user: {
            connect: { id: userId }, 
          },

          subscription: {
            connect: { userId }, 
          },
        },
      });
    }
    return {
      step: 'SUBSCRIPTION_CREATED',
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  }

  update(id: number, updatePlanDto: UpdatePlanDto) {
    return `This action updates a #${id} plan`;
  }

  remove(id: number) {
    return `This action removes a #${id} plan`;
  }
}
