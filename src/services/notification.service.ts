import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

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

  async findUserNotifications(userId: number): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
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

  async generateTravelRequestPDF(notification: Notification): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Add DepEd logo with proper error handling
        try {
          const logoPath = path.join(process.cwd(), 'public', 'depedlogo.jpeg');
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, {
              fit: [150, 150],
              align: 'center',
              x: 50,
              y: 50,
              format: 'jpeg'
            });
            doc.moveDown(2);
          } else {
            console.error('Logo file not found at:', logoPath);
          }
        } catch (error) {
          console.error('Error loading logo:', error);
        }

        // Add header
        doc.fontSize(20)
           .text('TRAVEL AUTHORITY', { align: 'center' })
           .moveDown();

        // Add notification details
        doc.fontSize(12)
           .text(`Date: ${notification.createdAt.toLocaleDateString()}`, { align: 'right' })
           .moveDown();

        // Add user details with null checks
        doc.fontSize(14)
           .text('Teacher Information:', { underline: true })
           .moveDown(0.5)
           .fontSize(12)
           .text(`Name: ${notification.user?.first_name || 'N/A'} ${notification.user?.last_name || ''}`)
           .text(`Position: ${notification.user?.position || 'N/A'}`)
           .text(`School: ${notification.user?.school_name || 'N/A'}`)
           .text(`District: ${notification.user?.district || 'N/A'}`)
           .moveDown();

        // Add notification message
        doc.fontSize(14)
           .text('Travel Request Details:', { underline: true })
           .moveDown(0.5)
           .fontSize(12)
           .text(notification.message || 'No details available')
           .moveDown();

        // Add footer
        doc.moveDown(2)
           .fontSize(10)
           .text('This is an official document of the Department of Education', { align: 'center' })
           .text('Unauthorized modifications are prohibited', { align: 'center' });

        doc.end();
      } catch (error) {
        console.error('Error generating PDF:', error);
        reject(new InternalServerErrorException('Failed to generate PDF'));
      }
    });
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user']
    });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    
    return notification;
  }
}
