import { TravelLeeway } from '../entities/travel-request.entity';

export class CreateTravelRequestDto {
  destination: string;
  purpose: string;
  travelDate: Date;
  leewayDays: TravelLeeway;
} 