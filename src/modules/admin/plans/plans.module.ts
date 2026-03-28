import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { StripeModule } from 'src/modules/payment/stripe/stripe.module';

@Module({
  imports: [StripeModule],
  providers: [PlansService],
  controllers: [PlansController],
})
export class PlansModule {}