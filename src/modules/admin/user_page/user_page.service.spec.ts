import { Test, TestingModule } from '@nestjs/testing';
import { UserPageService } from './user_page.service';

describe('UserPageService', () => {
  let service: UserPageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserPageService],
    }).compile();

    service = module.get<UserPageService>(UserPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
