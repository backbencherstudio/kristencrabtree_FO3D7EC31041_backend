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
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import { StripeService } from 'src/modules/payment/stripe/stripe.service';
@Injectable()
export class PlansService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private readonly stripeService: StripeService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  async createPlan(createPlanDto: CreatePlanDto) {
    const {
      title,
      description,
      subtitle,
      tag,
      features = [],
      price_in_cents,
      currency = 'usd',
      interval = 'month',
    } = createPlanDto;

    // 1. Create product + price on Stripe
    const { stripe_product_id, stripe_price_id } =
      await this.stripeService.createStripeProduct({
        title,
        description,
        price: price_in_cents,
        currency,
        interval,
      });

    // 2. Save plan in DB with Stripe IDs
    const plan = await this.prisma.plans.create({
      data: {
        title,
        description,
        subtitle,
        tag,
        features,
        price: (price_in_cents / 100).toFixed(2), // store as readable string e.g. "9.99"
        stripe_product_id,
        stripe_price_id,
      },
    });

    return {
      status: 'success',
      message: 'Plan created successfully',
      data: plan,
    };
  }

  async getPlans() {
    const prices = await this.stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    const dbPlans = await this.prisma.plans.findMany({
      where: { deleted_at: null },
    });

    const planMap = new Map(
      dbPlans.map((plan) => [plan.stripe_price_id, plan]),
    );

    return {
      success: true,
      data: prices.data.map((price) => {
        const dbPlan = planMap.get(price.id);

        return {
          id: dbPlan?.id || null, // ✅ DB ID added here
          stripe_price_id: price.id,

          name: (price.product as any).name,
          description: (price.product as any).description,

          amount: price.unit_amount,
          currency: price.currency,
          interval: price?.recurring?.interval || 'Not available',
          status: price.active,

          // optional DB fields (bonus)
          title: dbPlan?.title,
          subtitle: dbPlan?.subtitle,
          tag: dbPlan?.tag,
          features: dbPlan?.features || [],
        };
      }),
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
    // ── 1. Fetch plan from DB ──────────────────────────────────────────────
    const plan = await this.prisma.plans.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // ── 2. Handle free plan — no Stripe involved ───────────────────────────
    if (!plan.stripe_price_id) {
      // Check if user already has a subscription record
      const existingSubscription =
        await this.prisma.userSubscription.findUnique({
          where: { userId },
        });

      if (existingSubscription) {
        // If they had a paid plan, cancel it on Stripe first
        if (existingSubscription.stripeSubscriptionId) {
          await this.stripe.subscriptions.cancel(
            existingSubscription.stripeSubscriptionId,
          );
        }

        // Downgrade to free
        await this.prisma.userSubscription.update({
          where: { userId },
          data: {
            planId: plan.id,
            planName: plan.title,
            stripeSubscriptionId: null,
            status: 'active',
            method: null,
            cardLast4: null,
          },
        });
      } else {
        // First time — create free subscription record
        await this.prisma.userSubscription.create({
          data: {
            userId,
            planId: plan.id,
            planName: plan.title,
            status: 'active',
          },
        });
      }

      return {
        step: 'FREE_PLAN_ACTIVATED',
        message: 'Free plan activated successfully',
      };
    }

    // ── 3. Paid plan — proceed with Stripe ────────────────────────────────
    const customerId = await this.ensureCustomerForUser(userId);

    // Verify price still exists and is active on Stripe
    const stripePrice = await this.stripe.prices.retrieve(plan.stripe_price_id);
    if (!stripePrice || !stripePrice.active) {
      throw new BadRequestException('This plan is no longer available');
    }

    // ── PHASE 1 — Create SetupIntent (collect card) ────────────────────────
    if (!confirmed) {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: { userId, planId },
      });

      if (!setupIntent.client_secret) {
        throw new InternalServerErrorException('Failed to create setup intent');
      }

      return {
        step: 'SETUP_INTENT',
        clientSecret: setupIntent.client_secret,
        plan: {
          id: plan.id,
          title: plan.title,
          price: plan.price,
        },
      };
    }

    // ── PHASE 2 — Create Stripe subscription ──────────────────────────────
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (!paymentMethods.data.length) {
      throw new BadRequestException(
        'No payment method found. Please complete card setup first.',
      );
    }

    // Cancel existing paid subscription if upgrading/switching plans
    const existingSubscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existingSubscription?.stripeSubscriptionId) {
      await this.stripe.subscriptions.cancel(
        existingSubscription.stripeSubscriptionId,
      );
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripe_price_id }], // ← use price from DB plan
      default_payment_method: paymentMethods.data[0].id,
      collection_method: 'charge_automatically',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId,
        planId: plan.id, // ← our DB plan id, not Stripe price id
      },
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent =
      latestInvoice && typeof (latestInvoice as any).payment_intent !== 'string'
        ? ((latestInvoice as any).payment_intent as Stripe.PaymentIntent)
        : null;

    // ── Handle 3D Secure ───────────────────────────────────────────────────
    if (paymentIntent?.status === 'requires_action') {
      return {
        step: 'REQUIRES_ACTION',
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
      };
    }

    // ✅ Webhook will handle DB writes for paid plans
    return {
      step: 'SUBSCRIPTION_CREATED',
      subscriptionId: subscription.id,
      status: subscription.status,
      message: 'Subscription created successfully. Processing payment...',
    };
  }

  update(id: number, updatePlanDto: UpdatePlanDto) {
    return `This action updates a #${id} plan`;
  }

  remove(id: number) {
    return `This action removes a #${id} plan`;
  }
}
