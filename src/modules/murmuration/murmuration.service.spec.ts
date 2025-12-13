import { Test, TestingModule } from '@nestjs/testing';
import { MurmurationService } from './murmuration.service';

describe('MurmurationService', () => {
  let service: MurmurationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MurmurationService],
    }).compile();

    service = module.get<MurmurationService>(MurmurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
