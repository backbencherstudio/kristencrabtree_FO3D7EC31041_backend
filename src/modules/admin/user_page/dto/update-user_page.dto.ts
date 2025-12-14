import { PartialType } from '@nestjs/swagger';
import { CreateUserPageDto } from './create-user_page.dto';

export class UpdateUserPageDto extends PartialType(CreateUserPageDto) {}
