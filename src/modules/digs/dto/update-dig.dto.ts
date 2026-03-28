import { PartialType } from '@nestjs/swagger';
import { CreateDigDto } from './create-dig.dto';

export class UpdateDigDto extends PartialType(CreateDigDto) {}
