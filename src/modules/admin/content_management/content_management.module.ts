import { Module } from '@nestjs/common';
import { ContentManagementService } from './content_management.service';
import { ContentManagementController } from './content_management.controller';

@Module({
  controllers: [ContentManagementController],
  providers: [ContentManagementService],
})
export class ContentManagementModule {}
