import { Test, TestingModule } from '@nestjs/testing';
import { DigsService } from './digs.service';

describe('DigsService', () => {
  let service: DigsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DigsService],
    }).compile();

    service = module.get<DigsService>(DigsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
