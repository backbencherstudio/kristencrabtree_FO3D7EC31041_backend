import { Test, TestingModule } from '@nestjs/testing';
import { JournelsService } from './journels.service';

describe('JournelsService', () => {
  let service: JournelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JournelsService],
    }).compile();

    service = module.get<JournelsService>(JournelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
