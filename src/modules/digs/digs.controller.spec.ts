import { Test, TestingModule } from '@nestjs/testing';
import { DigsController } from './digs.controller';
import { DigsService } from './digs.service';

describe('DigsController', () => {
  let controller: DigsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DigsController],
      providers: [DigsService],
    }).compile();

    controller = module.get<DigsController>(DigsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
