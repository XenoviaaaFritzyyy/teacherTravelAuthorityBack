import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelRequestController } from '../controllers/travel-request.controller';
import { TravelRequestService } from '../services/travel-request.service';
import { TravelRequest } from '../entities/travel-request.entity';
import { NotificationModule } from './notification.module';
import { DateUtilModule } from './date-util.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TravelRequest]),
    NotificationModule,
    DateUtilModule,
  ],
  controllers: [TravelRequestController],
  providers: [TravelRequestService],
})
export class TravelRequestModule {}