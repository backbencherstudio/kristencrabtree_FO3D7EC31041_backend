import { Module } from '@nestjs/common';
import { MurmurationService } from './murmuration.service';
import { MurmurationController } from './murmuration.controller';

@Module({
  controllers: [MurmurationController],
  providers: [MurmurationService],
})
export class MurmurationModule {}
