import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(user: User, message: string, type: NotificationType): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user,
      message,
      type,
    });
    return await this.notificationRepository.save(notification);
  }

  async findUserNotifications(
    userId: number, 
    page: number = 1, 
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<{ notifications: Notification[], total: number }> {
    const skip = (page - 1) * limit;
    
    // Create query builder for more complex conditions
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    
    // Add date filtering if provided
    if (startDate) {
      queryBuilder.andWhere('notification.createdAt >= :startDate', { 
        startDate: new Date(startDate) 
      });
    }
    
    if (endDate) {
      // Set the end date to the end of the day
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('notification.createdAt <= :endDate', { 
        endDate: endDateTime 
      });
    }
    
    // Execute the query
    const [notifications, total] = await queryBuilder.getManyAndCount();
    
    return { notifications, total };
  }

  async markAsRead(notificationId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }

    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }
}
