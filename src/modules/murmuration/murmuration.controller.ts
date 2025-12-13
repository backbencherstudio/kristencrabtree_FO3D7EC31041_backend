import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MurmurationService } from './murmuration.service';
import { CreateMurmurationDto } from './dto/create-murmuration.dto';
import { UpdateMurmurationDto } from './dto/update-murmuration.dto';

@Controller('murmuration')
export class MurmurationController {
  constructor(private readonly murmurationService: MurmurationService) {}

  @Post()
  create(@Body() createMurmurationDto: CreateMurmurationDto) {
    return this.murmurationService.create(createMurmurationDto);
  }

  @Get()
  findAll() {
    return this.murmurationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.murmurationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMurmurationDto: UpdateMurmurationDto) {
    return this.murmurationService.update(+id, updateMurmurationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.murmurationService.remove(+id);
  }
}
