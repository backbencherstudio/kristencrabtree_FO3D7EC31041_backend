import { IsString } from "class-validator";

export class CreateContentManagementDto {
    @IsString()
    meditation_name : string

    @IsString()
    meditation_description:string
}
