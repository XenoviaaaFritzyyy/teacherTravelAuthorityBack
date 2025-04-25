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

  async createNotification(user: User, message: string, type: NotificationType, metadata?: any): Promise<Notification> {
    try {
      console.log(`Creating/updating notification for user ${user.id}, type: ${type}`);
      if (metadata) {
        console.log(`Notification metadata: ${JSON.stringify(metadata)}`);
      }

      // If metadata contains a notificationKey, use that to find existing notifications
      if (metadata && metadata.notificationKey) {
        console.log(`Looking for existing notification with key: ${metadata.notificationKey}`);
        const existingNotification = await this.findNotificationByKey(
          user.id,
          metadata.notificationKey
        );

        // If notification exists, update it instead of creating a new one
        if (existingNotification) {
          console.log(`Found existing notification with ID: ${existingNotification.id}, updating it`);
          return await this.updateNotification(existingNotification.id, message, type);
        } else {
          console.log(`No existing notification found with key: ${metadata.notificationKey}`);
        }
      }
      // Fallback to travelRequestId if notificationKey is not provided
      else if (metadata && metadata.travelRequestId) {
        console.log(`Looking for existing notification with travelRequestId: ${metadata.travelRequestId}`);
        const existingNotification = await this.findNotificationByTravelRequestId(
          user.id,
          metadata.travelRequestId
        );

        // If notification exists, update it instead of creating a new one
        if (existingNotification) {
          console.log(`Found existing notification with ID: ${existingNotification.id}, updating it`);
          return await this.updateNotification(existingNotification.id, message, type);
        } else {
          console.log(`No existing notification found with travelRequestId: ${metadata.travelRequestId}`);
        }
      }

      // Create a new notification if no existing one was found or no travelRequestId was provided
      console.log(`Creating new notification for user ${user.id}`);
      const notification = this.notificationRepository.create({
        user,
        message,
        type,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });
      const savedNotification = await this.notificationRepository.save(notification);
      console.log(`Created new notification with ID: ${savedNotification.id}`);
      return savedNotification;
    } catch (error) {
      console.error(`Error creating/updating notification: ${error.message}`);
      throw error;
    }
  }

  async updateNotification(id: number, message: string, type?: NotificationType): Promise<Notification> {
    try {
      console.log(`Updating notification with ID: ${id}`);
      console.log(`New message: ${message}`);
      if (type) {
        console.log(`New type: ${type}`);
      }

      const notification = await this.notificationRepository.findOne({
        where: { id },
      });
      
      if (!notification) {
        console.error(`Notification with ID ${id} not found`);
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      notification.message = message;
      if (type) {
        notification.type = type;
      }
      notification.isRead = false; // Reset read status since it's been updated
      
      const updatedNotification = await this.notificationRepository.save(notification);
      console.log(`Successfully updated notification with ID: ${id}`);
      return updatedNotification;
    } catch (error) {
      console.error(`Error updating notification: ${error.message}`);
      throw error;
    }
  }

  async findNotificationByKey(
    userId: number,
    notificationKey: string
  ): Promise<Notification | null> {
    try {
      const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
        .leftJoinAndSelect('notification.user', 'user')
        .where('user.id = :userId', { userId })
        .andWhere("notification.metadata LIKE :metadata", { 
          metadata: `%"notificationKey":"${notificationKey}"%` 
        });
      
      queryBuilder.orderBy('notification.createdAt', 'DESC');
      
      return await queryBuilder.getOne();
    } catch (error) {
      console.error(`Error finding notification by key: ${error.message}`);
      return null;
    }
  }

  async findNotificationByTravelRequestId(
    userId: number,
    travelRequestId: number
  ): Promise<Notification | null> {
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere("notification.metadata LIKE :metadata", { 
        metadata: `%"travelRequestId":${travelRequestId}%` 
      });
    
    // Removed type filter to find any notification for this travel request
    
    queryBuilder.orderBy('notification.createdAt', 'DESC');
    
    return await queryBuilder.getOne();
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
