import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelRequest, TravelRequestStatus, ValidationStatus } from '../entities/travel-request.entity';
import { CreateTravelRequestDto } from '../dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from '../dto/update-travel-request.dto';
import { User, UserRole } from '../entities/user.entity';
import { NotificationService } from './notification.service';
import { NotificationType } from '../entities/notification.entity';
import { DateUtilService } from './date-util.service';
import { LessThan, Not } from 'typeorm';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TravelRequestService {
  constructor(
    @InjectRepository(TravelRequest)
    private travelRequestRepository: Repository<TravelRequest>,
    private notificationService: NotificationService,
    private dateUtilService: DateUtilService,
  ) {}

  async create(createTravelRequestDto: CreateTravelRequestDto, user: User): Promise<TravelRequest> {
    const travelRequest = this.travelRequestRepository.create({
      ...createTravelRequestDto,
      user,
    });

    // Set the code expiration date to 2 working days after the start date
    const startDate = new Date(travelRequest.startDate);
    travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(startDate, 2);

    return await this.travelRequestRepository.save(travelRequest);
  }

  async findAll(): Promise<TravelRequest[]> {
    return await this.travelRequestRepository.find({
      relations: ['user'],
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findOne(id: number): Promise<TravelRequest> {
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }
    return travelRequest;
  }

  async update(id: number, updateTravelRequestDto: UpdateTravelRequestDto): Promise<TravelRequest> {
    const travelRequest = await this.findOne(id);
    Object.assign(travelRequest, updateTravelRequestDto);
    return await this.travelRequestRepository.save(travelRequest);
  }

  async updateStatus(id: number, status: TravelRequestStatus): Promise<TravelRequest> {
    const travelRequest = await this.findOne(id);
    travelRequest.status = status;
    
    if (status === TravelRequestStatus.ACCEPTED && !travelRequest.securityCode) {
      travelRequest.securityCode = this.generateSecurityCode(
        travelRequest.user.first_name,
        travelRequest.user.last_name
      );
      
      // Set expiration to end of the travel start date
      const expirationDate = new Date(travelRequest.startDate);
      expirationDate.setHours(23, 59, 59, 999);
      travelRequest.codeExpirationDate = expirationDate;
      
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been approved. Security Code: ${travelRequest.securityCode}. This code will expire at the end of ${expirationDate.toLocaleDateString()}.`,
        NotificationType.TRAVEL_REQUEST_APPROVED
      );
    }
    
    return await this.travelRequestRepository.save(travelRequest);
  }

  async remove(id: number): Promise<void> {
    const travelRequest = await this.findOne(id);
    await this.travelRequestRepository.remove(travelRequest);
  }

  async findAllPendingRequests(user: User): Promise<TravelRequest[]> {
    // Remove role restrictions, return all pending requests
    return await this.travelRequestRepository.find({
      where: { 
        status: TravelRequestStatus.PENDING
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async validateAndForwardToHead(id: number, head: User): Promise<TravelRequest> {
    if (head.role !== UserRole.AO_ADMIN) {
      throw new ForbiddenException('Only AO Admins can validate requests');
    }

    const travelRequest = await this.findOne(id);
    if (travelRequest.status !== TravelRequestStatus.PENDING || 
        travelRequest.validationStatus !== ValidationStatus.PENDING) {
      throw new ForbiddenException('Only pending requests can be validated');
    }

    // Here you would typically add validation logic
    // For example, checking if the travel dates are valid, purpose is clear, etc.
    
    // After validation, mark as validated but still pending for admin review
    travelRequest.validationStatus = ValidationStatus.VALIDATED;
    return await this.travelRequestRepository.save(travelRequest);
  }

  private generateSecurityCode(firstName: string, lastName: string): string {
    const initials = (firstName[0] + lastName[0]).toUpperCase();
    const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit number
    return `${initials}${randomNum}`;
  }

  async addRemarks(
    id: number, 
    remarks: string, 
    user: User
  ): Promise<TravelRequest> {
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }

    travelRequest.remarks = remarks;
    return await this.travelRequestRepository.save(travelRequest);
  }

  async adminReviewRequest(id: number, status: TravelRequestStatus, admin: User): Promise<TravelRequest> {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can review and make final decisions on requests');
    }

    const travelRequest = await this.findOne(id);
    if (travelRequest.status !== TravelRequestStatus.PENDING || 
        travelRequest.validationStatus !== ValidationStatus.VALIDATED) {
      throw new ForbiddenException('Only validated requests can be reviewed by admin');
    }

    travelRequest.status = status;
    
    if (status === TravelRequestStatus.ACCEPTED) {
      travelRequest.securityCode = this.generateSecurityCode(
        travelRequest.user.first_name,
        travelRequest.user.last_name
      );
      
      // Set expiration to 2 working days after start date
      const startDate = new Date(travelRequest.startDate);
      travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(startDate, 2);
    }
    
    const updatedRequest = await this.travelRequestRepository.save(travelRequest);

    if (status === TravelRequestStatus.ACCEPTED) {
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been approved. Security Code: ${travelRequest.securityCode}. 
        This code will be marked as expired after ${travelRequest.codeExpirationDate.toLocaleDateString()} 
        but will remain available for emergency purposes until your travel end date.`,
        NotificationType.TRAVEL_REQUEST_APPROVED
      );
    } else {
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been rejected.`,
        NotificationType.TRAVEL_REQUEST_REJECTED
      );
    }

    return updatedRequest;
  }

  @Cron('0 0 * * *') // Run daily at midnight
  async expireOldCodes() {
    try {
      console.log('Running expireOldCodes cron job');
      await this.checkAndUpdateExpiredCodes();
    } catch (error) {
      console.error('Error in expireOldCodes:', error);
    }
  }

  async checkAndUpdateExpiredCodes() {
    const today = new Date();
    console.log(`Checking for expired codes. Current date: ${today.toISOString()}`);
    
    // Find requests that need code expiration status update - those where the expiration date has passed
    const requestsToExpire = await this.travelRequestRepository.find({
      where: [
        {
        isCodeExpired: false,
        securityCode: Not(''),
        codeExpirationDate: LessThan(today)
      },
        // Also find codes that are marked as expired but still have a security code
        {
          isCodeExpired: true,
          securityCode: Not('')
        }
      ],
      relations: ['user']
    });

    console.log(`Found ${requestsToExpire.length} travel requests with expired codes or codes that need to be cleared`);
    
    // Debug information
    for (const request of requestsToExpire) {
      console.log(`Travel request ID: ${request.id}`);
      console.log(`Security Code: ${request.securityCode}`);
      console.log(`Code Expiration Date: ${request.codeExpirationDate?.toISOString() || 'No expiration date'}`);
      console.log(`Current isCodeExpired value: ${request.isCodeExpired}`);
      console.log(`Today's date for comparison: ${today.toISOString()}`);
      
      // Check if the code should be expired
      const shouldExpire = request.codeExpirationDate && request.codeExpirationDate < today;
      console.log(`Should expire based on date comparison: ${shouldExpire}`);
    }
    
    // Find requests where end date has passed (to clear security code)
    const requestsToClear = await this.travelRequestRepository.find({
      where: {
        endDate: LessThan(today),
        securityCode: Not('')
      },
      relations: ['user']
    });

    let expiredCount = 0;
    let clearedCount = 0;

    // Handle code expiration
    for (const request of requestsToExpire) {
      console.log(`Processing travel request ID: ${request.id}`);
      
      // Store the original security code for reference in the notification
      const originalCode = request.securityCode;
      
      if (!request.isCodeExpired && request.codeExpirationDate && request.codeExpirationDate < today) {
        // Mark as expired and clear the security code
        console.log(`Marking code as expired for travel request ID: ${request.id}`);
        request.isCodeExpired = true;
        expiredCount++;
      }
      
      // Clear the security code if it's expired or should be expired
      if (request.isCodeExpired && request.securityCode) {
        console.log(`Clearing security code for expired travel request ID: ${request.id}`);
        request.securityCode = '';
        
        // Save the updated request
        await this.travelRequestRepository.save(request);
        
        // Send notification only if we haven't already counted this as expired
        if (expiredCount > 0) {
          await this.notificationService.createNotification(
            request.user,
            `Your travel request security code ${originalCode} has expired and has been cleared from the system.`,
            NotificationType.TRAVEL_REQUEST_EXPIRED
          );
        }
      } else {
        // Save any other changes
        await this.travelRequestRepository.save(request);
      }
    }

    // Handle clearing codes (after end date)
    for (const request of requestsToClear) {
      // Only clear the code if the end date has truly passed
      if (request.endDate < today && request.securityCode) {
        console.log(`Clearing security code for travel request ID: ${request.id}, End date: ${request.endDate.toISOString()}`);
        request.securityCode = '';
        await this.travelRequestRepository.save(request);
        clearedCount++;

        await this.notificationService.createNotification(
          request.user,
          `Your travel period has ended and your security code has been cleared.`,
          NotificationType.TRAVEL_REQUEST_COMPLETED
        );
      } else {
        console.log(`Skipping clearing security code for travel request ID: ${request.id} as its end date has not passed yet`);
      }
    }

    console.log(`Marked ${expiredCount} codes as expired and cleared ${clearedCount} codes`);
    return { expired: expiredCount, cleared: clearedCount };
  }

  async findAllForAOAdmin(): Promise<TravelRequest[]> {
    try {
      return await this.travelRequestRepository
        .createQueryBuilder('travelRequest')
        .leftJoinAndSelect('travelRequest.user', 'user')
        .where('travelRequest.validationStatus IN (:...statuses)', {
          statuses: [
            ValidationStatus.PENDING,
            ValidationStatus.VALIDATED,
            ValidationStatus.REJECTED
          ]
        })
        .orderBy('travelRequest.createdAt', 'DESC')
        .getMany();
    } catch (error) {
      console.error('Error in findAllForAOAdmin:', error);
      throw new Error('Failed to fetch travel requests');
    }
  }

  async validateRequest(
    id: number, 
    validationStatus: ValidationStatus,
    user: User
  ): Promise<TravelRequest> {
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }

    travelRequest.validationStatus = validationStatus;
    return await this.travelRequestRepository.save(travelRequest);
  }

  async generateSecurityCodeForAcceptedRequest(id: number): Promise<TravelRequest> {
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }

    if (travelRequest.status !== TravelRequestStatus.ACCEPTED) {
      throw new ForbiddenException('Can only generate security codes for accepted requests');
    }

    if (!travelRequest.securityCode) {
      travelRequest.securityCode = this.generateSecurityCode(
        travelRequest.user.first_name,
        travelRequest.user.last_name
      );
      travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(new Date(), 7);
      
      // Create notification for the teacher with security code
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been approved. Security Code: ${travelRequest.securityCode}`,
        NotificationType.TRAVEL_REQUEST_APPROVED
      );
    }

    return await this.travelRequestRepository.save(travelRequest);
  }
} 