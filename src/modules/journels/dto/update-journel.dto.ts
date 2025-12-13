import { PartialType } from '@nestjs/swagger';
import { CreateJournelDto } from './create-journel.dto';

export class UpdateJournelDto extends PartialType(CreateJournelDto) {}
