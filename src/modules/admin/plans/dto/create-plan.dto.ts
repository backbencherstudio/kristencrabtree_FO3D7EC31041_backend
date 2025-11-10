import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";


export class CreatePlanDto {
@IsString()
title: string;

@IsString()
description: string;

@IsString()
price: string;

@IsString()
subtitle: string;

@IsString()
tag: string;

@IsString()
@Transform(({ value }) => value.join(','))
features: string;


}
