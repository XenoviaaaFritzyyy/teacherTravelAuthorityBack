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
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    TypeOrmModule.forRoot({
      type: process.env.DATABASE_TYPE as any || 'mysql',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '3306', 10),
      username: process.env.DATABASE_USERNAME || 'root',
      password: process.env.DATABASE_PASSWORD || '!Babyseeker123',
      database: process.env.DATABASE_NAME || 'travelauthority',
      entities: [User, TravelRequest, Notification],
      synchronize: process.env.NODE_ENV !== 'production',
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