import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from './entities/user.entity';
import { TravelRequest } from './entities/travel-request.entity';
import { Notification } from './entities/notification.entity';
import { AuthModule } from './auth/auth.module';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { TravelRequestModule } from './modules/travel-request.module';
import { NotificationModule } from './modules/notification.module';
import { DateUtilModule } from './modules/date-util.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '20031975',
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