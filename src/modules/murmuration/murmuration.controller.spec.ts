import { Test, TestingModule } from '@nestjs/testing';
import { MurmurationController } from './murmuration.controller';
import { MurmurationService } from './murmuration.service';

describe('MurmurationController', () => {
  let controller: MurmurationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MurmurationController],
      providers: [MurmurationService],
    }).compile();

    controller = module.get<MurmurationController>(MurmurationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
