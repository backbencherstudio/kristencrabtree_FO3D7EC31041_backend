import { PartialType } from '@nestjs/swagger';
import { CreateContentManagementDto } from './create-content_management.dto';

export class UpdateContentManagementDto extends PartialType(CreateContentManagementDto) {}
