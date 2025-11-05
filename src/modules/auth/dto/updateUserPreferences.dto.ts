import { Focus_Area, Weekly_Practice, Frequency, Content_Preference } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsString, IsEnum, IsBoolean, IsNotEmpty } from 'class-validator';

export class UserPreferencesDto {
    @IsNotEmpty()
    @IsString({ each: true })
    @Transform(({ value }) => (value ? (Array.isArray(value) ? value : [value]) : []))
    content_preference?: Content_Preference[];


    @IsNotEmpty()
    @IsEnum(Frequency)
    dailyWisdomQuotes: Frequency;

    @IsNotEmpty()
    @IsEnum(Frequency)
    guidedExercises: Frequency;

    @IsNotEmpty()
    @IsEnum(Frequency)
    meditationContent: Frequency;

    @IsNotEmpty()
    @IsEnum(Frequency)
    communityDiscussions: Frequency;

    @IsNotEmpty()
    @IsEnum(Frequency)
    journalPrompts: Frequency;

    @IsNotEmpty()
    @IsEnum(Frequency)
    scientificInsights: Frequency;

    @IsNotEmpty()
    @IsEnum(Focus_Area)
    focus_area: Focus_Area;

    @IsNotEmpty()
    @IsEnum(Weekly_Practice)
    weekly_practice: Weekly_Practice;
}
