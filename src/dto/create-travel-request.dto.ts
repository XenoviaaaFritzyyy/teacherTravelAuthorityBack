import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateTravelRequestDto {
  @IsNotEmpty()
  @IsString()
  purpose: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  securityCode?: string;
} 