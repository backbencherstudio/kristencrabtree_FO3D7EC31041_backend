import { Module } from '@nestjs/common';
import { ContentManagementService } from './content_management.service';
import { ContentManagementController } from './content_management.controller';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffprobeStatic from 'ffprobe-static';

@Module({
  controllers: [ContentManagementController],
  providers: [ContentManagementService],
})
export class ContentManagementModule {
  constructor() {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
  }
}
