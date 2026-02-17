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

      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;

        case 'payment_intent.created':
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;

          // Update transaction status in database
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
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
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

  /**
   * Handles invoice payment succeeded event
   * This runs on every invoice payment (including renewals)
   */
  private async handleInvoicePaymentSucceeded(invoice: any) {
    try {
      // Update user subscription valid until date
      const user= await this.prisma.user.update({
        where: { email: invoice.customer_email },
        data: {
          subscriptionValidUntil: invoice.period_end.toString(),
        },
        select:{
          id: true,
        }
      });

      // await this.prisma.userSubscription.update({
      //   where:{ userId: user.id },
      //   data:{
      //   }
      // })

      // Ignore the first invoice (subscription creation) - handle in subscription.created instead
      if (invoice.billing_reason === 'subscription_creation') {
        return;
      }

      // Handle renewals
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

  /**
   * Handles subscription created event
   * This is where we create the initial subscription record
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    try {
      const item = subscription.items.data[0];
      const price = item.price;
      
      // Fetch full product details
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
      const product = await stripe.products.retrieve(price.product as string);
      const planName = product.name;
      const planId = price.id;

      // Get customer to find userId
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const userId = (customer as Stripe.Customer).metadata?.userId || 
                     await this.getUserIdByBillingId(subscription.customer as string);

      if (!userId) {
        console.error('Cannot find userId for subscription:', subscription.id);
        return;
      }

      // Get payment method details
      const paymentMethod = subscription.default_payment_method
        ? await stripe.paymentMethods.retrieve(subscription.default_payment_method as string)
        : null;

      // Find access plan
      const accessPlan = await this.prisma.accessForSubscription.findFirst({
        where: {
          subscriptionName: planName.toLowerCase(),
        },
        select: {
          id: true,
        },
      });

      if (!accessPlan) {
        console.error(`No access plan found for subscription name: ${planName.toLowerCase()}`);
        return;
      }

      // Create subscription and transaction in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Upsert user subscription
        await tx.userSubscription.upsert({
          where: { userId },
          update: {
            planName,
            planId,
            stripeSubscriptionId: subscription.id,
            description: ['Stripe subscription'],
            allowedPermissions: ['premium'],
            status: subscription.status,
            cardLast4: paymentMethod?.card?.last4 || null,
            method: 'stripe',
            accessId: accessPlan.id,
          },
          create: {
            userId,
            planName,
            stripeSubscriptionId: subscription.id,
            planId,
            status: subscription.status,
            cardLast4: paymentMethod?.card?.last4 || null,
            method: 'stripe',
            description: ['Stripe subscription'],
            allowedPermissions: ['premium'],
            timesRenewed: 0,
            accessId: accessPlan.id,
          },
        });

        console.log(accessPlan);

        // Create payment transaction
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
            order_id: `${userId}-${planId}`,
            user: { connect: { id: userId } },
            subscription: { connect: { userId } },
          },
        });

        // Update user subscription plan
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: planName,
          },
        });
      });

      // Send notifications to admins
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

  /**
   * Handles subscription updated event
   * This handles status changes (active, canceled, past_due, etc.)
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    try {
      const sub = await this.prisma.userSubscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!sub) {
        console.error('Subscription not found:', subscription.id);
        return;
      }

      // Update subscription status
      await this.prisma.userSubscription.update({
        where: { id: sub.id },
        data: {
          status: subscription.status,
        },
      });

      // If subscription is canceled or unpaid, you might want to revoke access
      if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        await this.prisma.user.update({
          where: { id: sub.userId },
          data: {
            subscriptionPlan: 'free',
          },
        });
      }
    } catch (error) {
      console.error('Error handling subscription updated:', error);
      throw error;
    }
  }

  /**
   * Helper method to get userId from billing_id
   */
  private async getUserIdByBillingId(billingId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { billing_id: billingId },
      select: { id: true },
    });
    return user?.id || null;
  }
}