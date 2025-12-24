import { Test, TestingModule } from '@nestjs/testing';
import { ContentManagementService } from './content_management.service';

describe('ContentManagementService', () => {
  let service: ContentManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentManagementService],
    }).compile();

    service = module.get<ContentManagementService>(ContentManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
