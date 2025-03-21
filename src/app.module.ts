import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserController } from './controllers/user.controller';
import { Notification } from './entities/notification.entity';
import { TravelRequest } from './entities/travel-request.entity';
import { User } from './entities/user.entity';
import { DateUtilModule } from './modules/date-util.module';
import { NotificationModule } from './modules/notification.module';
import { TravelRequestModule } from './modules/travel-request.module';
import { UserService } from './services/user.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '!Babyseeker123',
      database: 'travelauthority',
      entities: [User, TravelRequest, Notification],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([User]),
    AuthModule,
    TravelRequestModule,
    NotificationModule,
    DateUtilModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class AppModule {}