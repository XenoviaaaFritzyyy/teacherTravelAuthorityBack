import { Injectable } from '@nestjs/common';

@Injectable()
export class DateUtilService {
  addWorkingDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) { // Skip weekends
        addedDays++;
      }
    }
    
    return result;
  }
} 