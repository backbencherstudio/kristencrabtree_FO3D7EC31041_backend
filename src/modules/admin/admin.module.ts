import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { WebsiteInfoModule } from './website-info/website-info.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { PlansModule } from './plans/plans.module';
import { UserPageModule } from './user_page/user_page.module';
import { ContentManagementModule } from './content_management/content_management.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    WebsiteInfoModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    PlansModule,
    UserPageModule,
    ContentManagementModule,
  ],
})
export class AdminModule {}
