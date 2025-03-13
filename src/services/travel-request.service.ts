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
import { LessThan } from 'typeorm';
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
    return await this.travelRequestRepository.save(travelRequest);
  }

  async findAll(): Promise<TravelRequest[]> {
    return await this.travelRequestRepository.find({
      relations: ['user'],
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
    return await this.travelRequestRepository.save(travelRequest);
  }

  async remove(id: number): Promise<void> {
    const travelRequest = await this.findOne(id);
    await this.travelRequestRepository.remove(travelRequest);
  }

  async findAllPendingRequests(user: User): Promise<TravelRequest[]> {
    if (user.role === UserRole.AO_ADMIN) {
      // AO Admins can see all pending requests
      return await this.travelRequestRepository.find({
        where: { 
          status: TravelRequestStatus.PENDING,
          validationStatus: ValidationStatus.PENDING
        },
        relations: ['user'],
      });
    } else if (user.role === UserRole.ADMIN) {
      // Admins can only see validated requests
      return await this.travelRequestRepository.find({
        where: { 
          status: TravelRequestStatus.PENDING,
          validationStatus: ValidationStatus.VALIDATED
        },
        relations: ['user'],
      });
    }
    throw new ForbiddenException('Only AO Admins and admins can view pending requests');
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

  async addRemarks(id: number, remarks: string, user: User): Promise<TravelRequest> {
    if (user.role !== UserRole.AO_ADMIN && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only AO Admin and Admin can add remarks');
    }

    const travelRequest = await this.findOne(id);
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
    travelRequest.securityCode = this.generateSecurityCode(
      travelRequest.user.first_name,
      travelRequest.user.last_name
    );
    
    if (status === TravelRequestStatus.ACCEPTED) {
      travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(new Date(), 7);
    }
    
    const updatedRequest = await this.travelRequestRepository.save(travelRequest);

    // Create notification for the teacher with security code
    const notificationType = status === TravelRequestStatus.ACCEPTED 
      ? NotificationType.TRAVEL_REQUEST_APPROVED 
      : NotificationType.TRAVEL_REQUEST_REJECTED;

    const message = status === TravelRequestStatus.ACCEPTED
      ? `Your travel request to ${travelRequest.destination} has been approved. Security Code: ${travelRequest.securityCode}`
      : `Your travel request to ${travelRequest.destination} has been rejected.`;

    await this.notificationService.createNotification(
      travelRequest.user,
      message,
      notificationType
    );

    return updatedRequest;
  }

  @Cron('0 0 * * *') // Run daily at midnight
  async expireOldCodes() {
    const today = new Date();
    const expiredRequests = await this.travelRequestRepository.find({
      where: {
        codeExpirationDate: LessThan(today),
        isCodeExpired: false
      }
    });

    for (const request of expiredRequests) {
      request.isCodeExpired = true;
      request.securityCode = undefined;
      await this.travelRequestRepository.save(request);
    }
  }

  async findAllForAOAdmin(): Promise<TravelRequest[]> {
    return await this.travelRequestRepository.find({
      where: [
        { validationStatus: ValidationStatus.PENDING },
        { validationStatus: ValidationStatus.VALIDATED }
      ],
      relations: ['user'],
      order: {
        createdAt: 'DESC'
      }
    });
  }
} 