import { Module } from '@nestjs/common';
import { DateUtilService } from '../services/date-util.service';

@Module({
  providers: [DateUtilService],
  exports: [DateUtilService]
})
export class DateUtilModule {} 