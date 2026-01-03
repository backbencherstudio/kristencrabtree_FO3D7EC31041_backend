import { Module } from '@nestjs/common';
import { DigsService } from './digs.service';
import { DigsController } from './digs.controller';

@Module({
  controllers: [DigsController],
  providers: [DigsService],
})
export class DigsModule {}
