import { Focus_Area, Weekly_Practice, Frequency, Content_Preference } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsString, IsEnum, IsBoolean } from 'class-validator';

export class UserPreferencesDto {

    @IsString({ each: true })
    @Transform(({ value }) => (value ? (Array.isArray(value) ? value : [value]) : [])) 
    content_preference?: Content_Preference[];

    @IsEnum(Frequency)
    dailyWisdomQuotes?: Frequency;

    @IsEnum(Frequency)
    guidedExercises?: Frequency;

    @IsEnum(Frequency)
    meditationContent?: Frequency;

    @IsEnum(Frequency)
    communityDiscussions?: Frequency;

    @IsEnum(Frequency)
    journalPrompts?: Frequency;

    @IsEnum(Frequency)
    scientificInsights?: Frequency;

    @IsEnum(Focus_Area)
    focus_area?: Focus_Area;

    @IsEnum(Weekly_Practice)
    weekly_practice?: Weekly_Practice;
}
