import { Controller, Get, Patch, Param, UseGuards, Request, Res, InternalServerErrorException } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findUserNotifications(@Request() req) {
    return this.notificationService.findUserNotifications(req.user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(+id);
  }

  @Get(':id/pdf')
  async downloadPDF(@Param('id') id: string, @Res() res: Response) {
    try {
      const notification = await this.notificationService.findOne(+id);
      const pdfBuffer = await this.notificationService.generateTravelRequestPDF(notification);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=travel-authority-${id}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Failed to generate PDF');
    }
  }
} 