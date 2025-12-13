import { Module } from '@nestjs/common';
import { JournelsService } from './journels.service';
import { JournelsController } from './journels.controller';

@Module({
  controllers: [JournelsController],
  providers: [JournelsService],
})
export class JournelsModule {}
