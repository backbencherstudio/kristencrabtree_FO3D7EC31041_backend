import { Focus_Area } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsArray()
  @IsEnum(Focus_Area, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  type: Focus_Area[];

  @IsString()
  quote_author?: string;

  @IsString()
  quote_text?: string;

  @IsString()
  reason?: string;
}

/*
model Quote {
  id         String    @id @default(cuid())
  created_at DateTime  @default(now())
  updated_at DateTime  @default(now())
  deleted_at DateTime?

  quote_author String?
  quote_text   String? @db.Text
  reason       String? @db.Text

  user_id String?
  user    User?   @relation(fields: [user_id], references: [id])

  @@map("quotes")
}
*/
