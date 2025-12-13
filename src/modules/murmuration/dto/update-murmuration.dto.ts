import { PartialType } from '@nestjs/swagger';
import { CreateMurmurationDto } from './create-murmuration.dto';

export class UpdateMurmurationDto extends PartialType(CreateMurmurationDto) {}
