import { Injectable } from '@nestjs/common';
import { CreateMurmurationDto } from './dto/create-murmuration.dto';
import { UpdateMurmurationDto } from './dto/update-murmuration.dto';

@Injectable()
export class MurmurationService {
  create(createMurmurationDto: CreateMurmurationDto) {
    return 'This action adds a new murmuration';
  }

  findAll() {
    return `This action returns all murmuration`;
  }

  findOne(id: number) {
    return `This action returns a #${id} murmuration`;
  }

  update(id: number, updateMurmurationDto: UpdateMurmurationDto) {
    return `This action updates a #${id} murmuration`;
  }

  remove(id: number) {
    return `This action removes a #${id} murmuration`;
  }
}
