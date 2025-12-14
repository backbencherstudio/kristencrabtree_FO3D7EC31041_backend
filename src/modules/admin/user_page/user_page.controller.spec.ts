import { Test, TestingModule } from '@nestjs/testing';
import { UserPageController } from './user_page.controller';
import { UserPageService } from './user_page.service';

describe('UserPageController', () => {
  let controller: UserPageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserPageController],
      providers: [UserPageService],
    }).compile();

    controller = module.get<UserPageController>(UserPageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
