import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import Stripe from 'stripe';
import appConfig from 'src/config/app.config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(appConfig().payment.stripe.secret_key, {
      apiVersion: '2025-03-31.basil',
    });
  }
  async handleWebhook(rawBody: string, sig: string | string[]) {
    return StripePayment.handleWebhook(rawBody, sig);
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
}
