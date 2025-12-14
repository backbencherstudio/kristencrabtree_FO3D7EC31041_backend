import { Module } from '@nestjs/common';
import { UserPageService } from './user_page.service';
import { UserPageController } from './user_page.controller';

@Module({
  controllers: [UserPageController],
  providers: [UserPageService],
})
export class UserPageModule {}
