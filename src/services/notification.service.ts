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
    
    // Build query conditions
    const whereCondition: any = { user: { id: userId } };
    
    // Add date filtering if provided
    if (startDate || endDate) {
      whereCondition.createdAt = {};
      
      if (startDate) {
        whereCondition.createdAt.gte = new Date(startDate);
      }
      
      if (endDate) {
        // Set the end date to the end of the day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereCondition.createdAt.lte = endDateTime;
      }
    }
    
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: whereCondition,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    
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
