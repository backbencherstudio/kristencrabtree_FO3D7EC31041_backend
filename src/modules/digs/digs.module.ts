import { Module } from '@nestjs/common';
import { DigsService } from './digs.service';
import { DigsController } from './digs.controller';
import { DigsReminderService } from './digs-reminder.service';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule], // ← no ScheduleModule here
  controllers: [DigsController],
  providers: [DigsService, DigsReminderService],
})
export class DigsModule {}
