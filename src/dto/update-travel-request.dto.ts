import { PartialType } from '@nestjs/mapped-types';
import { CreateTravelRequestDto } from './create-travel-request.dto';

export class UpdateTravelRequestDto extends PartialType(CreateTravelRequestDto) {} 