import { Injectable } from '@nestjs/common';
import { CreateDigDto } from './dto/create-dig.dto';
import { UpdateDigDto } from './dto/update-dig.dto';

@Injectable()
export class DigsService {
  createResponse(createDigDto: CreateDigDto) {
    return 'This action adds a new dig';
  }

  findAll() {
    return `This action returns all digs`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dig`;
  }

  update(id: number, updateDigDto: UpdateDigDto) {
    return `This action updates a #${id} dig`;
  }

  remove(id: number) {
    return `This action removes a #${id} dig`;
  }
}
