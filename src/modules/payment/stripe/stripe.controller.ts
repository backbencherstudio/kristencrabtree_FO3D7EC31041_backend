import { Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody;
      const event = await this.stripeService.handleWebhook(payload, signature);

      console.log(event.type);

      switch (event.type) {
        case 'customer.created':
          break;

        case 'payment_intent.created':
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await TransactionRepository.updateTransaction({
            reference_number: paymentIntent.id,
            status: 'succeeded',
            paid_amount: paymentIntent.amount / 100,
            paid_currency: paymentIntent.currency,
            raw_status: paymentIntent.status,
          });
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as any);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object;
          await TransactionRepository.updateTransaction({
            reference_number: failedPaymentIntent.id,
            status: 'failed',
            raw_status: failedPaymentIntent.status,
          });
          break;

        case 'payment_intent.canceled':
          const canceledPaymentIntent = event.data.object;
          await TransactionRepository.updateTransaction({
            reference_number: canceledPaymentIntent.id,
            status: 'canceled',
            raw_status: canceledPaymentIntent.status,
          });
          break;

        case 'payment_intent.requires_action':
          const requireActionPaymentIntent = event.data.object;
          await TransactionRepository.updateTransaction({
            reference_number: requireActionPaymentIntent.id,
            status: 'requires_action',
            raw_status: requireActionPaymentIntent.status,
          });
          break;

        case 'payout.paid':
          const paidPayout = event.data.object;
          console.log(paidPayout);
          break;

        case 'payout.failed':
          const failedPayout = event.data.object;
          console.log(failedPayout);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICE PAYMENT SUCCEEDED
  // Fires on every successful invoice — including first payment and renewals.
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleInvoicePaymentSucceeded(invoice: any) {
    try {
      // period_end is a Unix timestamp — convert to ISO string
      const validUntil = new Date(invoice.period_end * 1000).toISOString();

      // Always keep subscriptionValidUntil current
      await this.prisma.user.update({
        where: { email: invoice.customer_email },
        data: { subscriptionValidUntil: validUntil },
      });

      // First-time payment is fully handled in handleSubscriptionCreated
      if (invoice.billing_reason === 'subscription_creation') {
        return;
      }

      // Renewal — increment counter
      if (invoice.billing_reason === 'subscription_cycle') {
        const subscriptionId = invoice.subscription as string;
        const sub = await this.prisma.userSubscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (sub) {
          await this.prisma.userSubscription.update({
            where: { id: sub.id },
            data: { timesRenewed: { increment: 1 } },
          });
        }
      }
    } catch (error) {
      console.error('Error handling invoice payment succeeded:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION CREATED
  // Creates the initial subscription record and updates the user plan fields.
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

      const item = subscription.items.data[0];
      const price = item.price;

      // Fetch product to get human-readable plan name
      const product = await stripe.products.retrieve(price.product as string);
      const planName = product.name; // e.g. "Monthly", "Annual", "Lifetime"

      // ── Resolve userId ──────────────────────────────────────────────────
      const customer = await stripe.customers.retrieve(
        subscription.customer as string,
      );
      const userId =
        (customer as Stripe.Customer).metadata?.userId ||
        (await this.getUserIdByBillingId(subscription.customer as string));

      if (!userId) {
        console.error('Cannot find userId for subscription:', subscription.id);
        return;
      }

      // ── Look up our DB plan row by Stripe price id ──────────────────────
      // Gives us the canonical plan_id (e.g. plan_monthly) instead of price_xxx
      const planRow = await this.prisma.plans.findFirst({
        where: { stripe_price_id: price.id },
      });

      if (!planRow) {
        console.warn(
          `No plans row found for stripe_price_id: ${price.id} — subscription still recorded`,
        );
      }

      // ── Subscription valid until ────────────────────────────────────────
      // current_period_end lives on the subscription item in newer Stripe SDK
      // versions. Cast to any as a safe fallback so both SDK shapes are handled.
      const periodEnd: number =
        (subscription as any).current_period_end ?? item.current_period_end;
      const validUntil = new Date(periodEnd * 1000).toISOString();

      // ── Payment method ──────────────────────────────────────────────────
      const paymentMethod = subscription.default_payment_method
        ? await stripe.paymentMethods.retrieve(
            subscription.default_payment_method as string,
          )
        : null;

      // ── Access plan ─────────────────────────────────────────────────────
      const accessPlan = await this.prisma.accessForSubscription.findFirst({
        where: { subscriptionName: planName.toLowerCase() },
        select: { id: true },
      });

      if (!accessPlan) {
        console.warn(
          `No access plan found for subscription name: ${planName.toLowerCase()}`,
        );
      }

      // ── Persist everything atomically ───────────────────────────────────
      await this.prisma.$transaction(async (tx) => {
        // 1. Upsert UserSubscription
        await tx.userSubscription.upsert({
          where: { userId },
          update: {
            planName,
            planId: planRow?.id ?? price.id,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            cardLast4: paymentMethod?.card?.last4 ?? null,
            method: 'stripe',
            description: ['Stripe subscription'],
            allowedPermissions: ['premium'],
            accessId: accessPlan?.id ?? null,
          },
          create: {
            userId,
            planName,
            planId: planRow?.id ?? price.id,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            cardLast4: paymentMethod?.card?.last4 ?? null,
            method: 'stripe',
            description: ['Stripe subscription'],
            allowedPermissions: ['premium'],
            timesRenewed: 0,
            accessId: accessPlan?.id ?? null,
          },
        });

        // 2. Create payment transaction record
        await tx.paymentTransaction.create({
          data: {
            type: 'subscription',
            provider: 'stripe',
            status: 'succeeded',
            raw_status: subscription.status,
            amount: price.unit_amount
              ? new Prisma.Decimal(price.unit_amount / 100)
              : null,
            currency: price.currency,
            order_id: `${userId}-${price.id}`,
            user: { connect: { id: userId } },
            subscription: { connect: { userId } },
          },
        });

        console.log(planName);

        // 3. Update User — both plan name AND valid-until in one write
        //    This is what was missing: subscriptionPlan stayed "free" because
        //    it was never set here, and subscriptionValidUntil was skipped for
        //    subscription_creation billing reason in the invoice handler.
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: planName,
            subscriptionValidUntil: validUntil,
          },
        });
      });

      // ── Notify admins ───────────────────────────────────────────────────
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const admins = await this.prisma.user.findMany({
        where: { type: 'admin' },
      });

      for (const admin of admins) {
        this.messageGateway.sendNotification(admin.id, {
          type: 'subscription',
          text: `${user.first_name} subscribed to ${planName} plan`,
        });
      }
    } catch (error) {
      console.error('Error handling subscription created:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION UPDATED
  // Handles status changes: active → canceled, past_due, unpaid, etc.
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    try {
      const sub = await this.prisma.userSubscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!sub) {
        console.error('Subscription not found:', subscription.id);
        return;
      }

      await this.prisma.userSubscription.update({
        where: { id: sub.id },
        data: { status: subscription.status },
      });

      // Revoke premium access when subscription lapses
      if (
        subscription.status === 'canceled' ||
        subscription.status === 'unpaid'
      ) {
        await this.prisma.user.update({
          where: { id: sub.userId },
          data: { subscriptionPlan: 'free' },
        });
      }
    } catch (error) {
      console.error('Error handling subscription updated:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getUserIdByBillingId(
    billingId: string,
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { billing_id: billingId },
      select: { id: true },
    });
    return user?.id ?? null;
  }
}
