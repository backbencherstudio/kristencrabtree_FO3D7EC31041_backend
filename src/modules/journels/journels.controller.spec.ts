import { Test, TestingModule } from '@nestjs/testing';
import { JournelsController } from './journels.controller';
import { JournelsService } from './journels.service';

describe('JournelsController', () => {
  let controller: JournelsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JournelsController],
      providers: [JournelsService],
    }).compile();

    controller = module.get<JournelsController>(JournelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
