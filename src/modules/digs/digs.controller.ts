import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DigsService } from './digs.service';
import { CreateDigDto } from './dto/create-dig.dto';
import { UpdateDigDto } from './dto/update-dig.dto';

@Controller('digs')
export class DigsController {
  constructor(private readonly digsService: DigsService) {}

  @Post()
  createResponse(@Body() createDigDto: CreateDigDto) {
    return this.digsService.createResponse(createDigDto);
  }

  @Get()
  findAll() {
    return this.digsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.digsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDigDto: UpdateDigDto) {
    return this.digsService.update(+id, updateDigDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.digsService.remove(+id);
  }
}
