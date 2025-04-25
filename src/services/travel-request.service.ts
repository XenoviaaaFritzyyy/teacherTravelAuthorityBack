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

    // Check if the department array contains "Others" or a custom department that's not in the standard list
    const standardDepartments = [
      "Accounting", "Administrative Office", "Assessment and Evaluation",
      "Assistant Schools Division Superintendent (Cluster A)", "Assistant Schools Division Superintendent (Cluster B)",
      "Assistant Schools Division Superintendent (Cluster C)", "Authorized Center", "Authorized Officer",
      "Authorized Official", "Budget", "Cashier", "CID", "Client", "Curriculum Management",
      "Dental", "Disbursing", "Educational Support Staff and Development", "Educational Facilities",
      "General Services", "HRTD", "Human Resource Management", "ICT", "Instructional Supervision",
      "Learning and Development", "Legal", "LRMDS", "M and E", "Medical",
      "Office of the Schools Division Superintendent", "Physical Facilities", "Planning",
      "Records", "Remittance", "School Governance", "SGOD", "Soc. Mob", "Super User", "Supply", "Unassigned User"
    ];

    const hasCustomDepartment = travelRequest.department.some(dept => !standardDepartments.includes(dept));

    // If there's a custom department, set status to pending and wait for validation
    if (hasCustomDepartment) {
      travelRequest.status = TravelRequestStatus.PENDING;
      travelRequest.validationStatus = ValidationStatus.PENDING;
    }

    // Save the travel request first
    const savedRequest = await this.travelRequestRepository.save(travelRequest);

    // Find the appropriate validator based on user's role
    let validatorRole: UserRole;
    switch (user.role) {
      case UserRole.ASDS:
        validatorRole = UserRole.SDS;
        break;
      default:
        validatorRole = UserRole.ADMIN;
    }

    // Create a single notification for the requester
    const notificationKeyForRequester = `travel-request-user-${user.id}-${savedRequest.id}`;
    console.log(`Creating notification for requester with key: ${notificationKeyForRequester}`);
    
    await this.notificationService.createNotification(
      user,
      `Your travel request to ${travelRequest.department.join(', ')} has been submitted and is pending validation.`,
      NotificationType.TRAVEL_REQUEST_VALIDATED,
      { 
        travelRequestId: savedRequest.id, 
        notificationKey: notificationKeyForRequester,
        userRole: 'requester'
      }
    );
    
    if (validatorRole) {
      // Find all users with the validator role
      const validators = await this.findUsersByRole(validatorRole);
      
      // Create separate notifications for validators with user-specific notification keys
      for (const validator of validators) {
        const notificationKeyForValidator = `travel-request-user-${validator.id}-${savedRequest.id}`;
        console.log(`Creating notification for validator ${validator.id} with key: ${notificationKeyForValidator}`);
        
        await this.notificationService.createNotification(
          validator,
          `A new travel request requires your validation from ${user.first_name} ${user.last_name}.`,
          NotificationType.TRAVEL_REQUEST_VALIDATED,
          { 
            travelRequestId: savedRequest.id, 
            notificationKey: notificationKeyForValidator,
            userRole: 'validator'
          }
        );
      }
    }

    return savedRequest;
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
    
    if (status === TravelRequestStatus.ACCEPTED) {
      // Generate security code if it doesn't exist
      if (!travelRequest.securityCode) {
        travelRequest.securityCode = this.generateSecurityCode(
          travelRequest.user.first_name,
          travelRequest.user.last_name
        );
        
        // Set expiration to 2 working days after the start date
        const startDate = new Date(travelRequest.startDate);
        travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(startDate, 2);
        
        // Send notification about the approval and security code
        const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
        console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
        
        await this.notificationService.createNotification(
          travelRequest.user,
          `Your travel request has been approved. Security Code: ${travelRequest.securityCode}. This code will expire after ${travelRequest.codeExpirationDate.toLocaleDateString()}.`,
          NotificationType.TRAVEL_REQUEST_APPROVED,
          { 
            travelRequestId: travelRequest.id, 
            notificationKey: notificationKeyForRequester,
            userRole: 'requester',
            status: 'approved'
          }
        );

        // If the request has departments, notify AO_ADMIN users
        if (travelRequest.department && travelRequest.department.length > 0) {
          const aoAdmins = await this.findAOAdminUsers();
          for (const admin of aoAdmins) {
            const notificationKeyForAdmin = `travel-request-user-${admin.id}-${travelRequest.id}`;
            console.log(`Creating/updating notification for admin ${admin.id} with key: ${notificationKeyForAdmin}`);
            
            await this.notificationService.createNotification(
              admin,
              `A travel request from ${travelRequest.user.first_name} ${travelRequest.user.last_name} has been approved and requires your attention.`,
              NotificationType.TRAVEL_REQUEST_VALIDATED,
              { 
                travelRequestId: travelRequest.id, 
                notificationKey: notificationKeyForAdmin,
                userRole: 'admin',
                status: 'approved'
              }
            );
          }
        }
      }
    }
    
    return await this.travelRequestRepository.save(travelRequest);
  }

  async remove(id: number): Promise<void> {
    const travelRequest = await this.findOne(id);
    await this.travelRequestRepository.remove(travelRequest);
  }

  async findAllPendingRequests(user: User): Promise<TravelRequest[]> {
    try {
      // Simple approach: use a single query with proper conditions
      let query = this.travelRequestRepository.createQueryBuilder('travelRequest')
        .leftJoinAndSelect('travelRequest.user', 'user')
        .orderBy('travelRequest.createdAt', 'DESC');

      // Add role-specific conditions
      if (user.role === UserRole.PRINCIPAL) {
        query = query.where(
          'user.role = :teacherRole AND user.school_id = :schoolId',
          { 
            teacherRole: UserRole.TEACHER, 
            schoolId: user.school_id
          }
        );
      } else if (user.role === UserRole.PSDS) {
        query = query.where(
          'user.role = :principalRole AND user.district = :district',
          { 
            principalRole: UserRole.PRINCIPAL, 
            district: user.district 
          }
        );
      } else if (user.role === UserRole.ASDS) {
        query = query.where(
          'user.role = :psdsRole',
          { 
            psdsRole: UserRole.PSDS 
          }
        );
      } else if (user.role === UserRole.SDS) {
        query = query.where(
          'user.role = :asdsRole',
          { 
            asdsRole: UserRole.ASDS 
          }
        );
      } else {
        // For any other role, return an empty array
        return [];
      }

      return await query.getMany();
    } catch (error) {
      console.error('Error in findAllPendingRequests:', error);
      return []; // Return empty array on error
    }
  }

  async markAsViewed(id: number): Promise<TravelRequest> {
    const travelRequest = await this.findOne(id);
    // Use type assertion to tell TypeScript that this property exists
    (travelRequest as any).viewed = true;
    return await this.travelRequestRepository.save(travelRequest);
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

    // Check if the user has permission to validate this request based on roles
    const canValidate = this.canUserValidateRequest(user, travelRequest.user);
    if (!canValidate) {
      throw new ForbiddenException(`User with role ${user.role} cannot validate requests from ${travelRequest.user.role}`);
    }

    travelRequest.validationStatus = validationStatus;
    
    // If validated, also update the status to accepted
    if (validationStatus === ValidationStatus.VALIDATED) {
      travelRequest.status = TravelRequestStatus.ACCEPTED;
      
      // Generate security code for accepted requests
      if (!travelRequest.securityCode) {
        travelRequest.securityCode = this.generateSecurityCode(
          travelRequest.user.first_name,
          travelRequest.user.last_name
        );
        
        // Set expiration date
        const startDate = new Date(travelRequest.startDate);
        travelRequest.codeExpirationDate = this.dateUtilService.addWorkingDays(startDate, 2);
      }
      
      // Check user position to determine notification type
      // Only send TRAVEL_REQUEST_VALIDATED notification if not approved by Admin Officer
      const isAdminOfficer = user.position && (
        user.position.toLowerCase().includes('administrative officer') || 
        user.position.toLowerCase().includes('admin officer') ||
        user.role === UserRole.ADMIN
      );

      // Only send validation notification if not from Admin Officer
      if (!isAdminOfficer) {
        // Send notification to the user about the validation
        const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
        console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
        
        await this.notificationService.createNotification(
          travelRequest.user,
          `Your travel request has been validated by ${user.first_name} ${user.last_name}.`,
          NotificationType.TRAVEL_REQUEST_VALIDATED,
          { 
            travelRequestId: travelRequest.id, 
            notificationKey: notificationKeyForRequester,
            userRole: 'requester',
            validatorName: `${user.first_name} ${user.last_name}`, 
            validationDate: new Date().toISOString(),
            status: 'validated'
          }
        );
      }
      
      // For Admin Officer validation, the notification will be sent via receipt notification
      // to avoid duplication
    } else if (validationStatus === ValidationStatus.REJECTED) {
      // If rejected, update the status to rejected
      travelRequest.status = TravelRequestStatus.REJECTED;
      
      // Notify the user that their request has been rejected
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been rejected.`,
        NotificationType.TRAVEL_REQUEST_REJECTED
      );
    }
    
    return await this.travelRequestRepository.save(travelRequest);
  }

  // Helper method to find all AO_ADMIN users
  private async findAOAdminUsers(): Promise<User[]> {
    // We need to inject the User repository to perform this query
    // This should be done in the constructor, but for now we'll use the EntityManager
    const entityManager = this.travelRequestRepository.manager;
    
    // Query all users with the AO_ADMIN role
    const aoAdmins = await entityManager.find(User, {
      where: { role: UserRole.AO_ADMIN }
    });
    
    return aoAdmins;
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

    const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
    console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
    
    if (status === TravelRequestStatus.ACCEPTED) {
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been approved. Security Code: ${travelRequest.securityCode}. 
        This code will be marked as expired after ${travelRequest.codeExpirationDate.toLocaleDateString()} 
        but will remain available for emergency purposes until your travel end date.`,
        NotificationType.TRAVEL_REQUEST_APPROVED,
        { 
          travelRequestId: travelRequest.id, 
          notificationKey: notificationKeyForRequester, 
          userRole: 'requester',
          adminId: admin.id,
          status: 'approved'
        }
      );
    } else {
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been rejected.`,
        NotificationType.TRAVEL_REQUEST_REJECTED,
        { 
          travelRequestId: travelRequest.id, 
          notificationKey: notificationKeyForRequester, 
          userRole: 'requester',
          adminId: admin.id,
          status: 'rejected'
        }
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
    
    // Group requests by user to avoid sending multiple notifications to the same user
    const userRequestMap = new Map<number, TravelRequest[]>();
    
    for (const request of requestsToExpire) {
      const userId = request.user.id;
      if (!userRequestMap.has(userId)) {
        userRequestMap.set(userId, []);
      }
      const userRequests = userRequestMap.get(userId);
      if (userRequests) {
        userRequests.push(request);
      }
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

    // Process requests by user to avoid notification spam
    for (const [userId, userRequests] of userRequestMap.entries()) {
      const user = userRequests[0].user; // All requests in this group have the same user
      const expiredRequests = userRequests.filter(req => 
        !req.isCodeExpired && req.codeExpirationDate && req.codeExpirationDate < today
      );
      
      // Only send one notification per user for all expired requests
      if (expiredRequests.length > 0) {
        // Mark all as expired
        for (const request of expiredRequests) {
          console.log(`Marking code as expired for travel request ID: ${request.id}`);
          request.isCodeExpired = true;
          expiredCount++;
        }
        
        // Get request IDs for the notification message
        const requestIds = expiredRequests.map(req => req.id).join(', ');
        
        // Find the original notification for the first expired request to update it
        // This ensures we update the existing notification instead of creating a new one
        const firstRequest = expiredRequests[0];
        const notificationKeyForRequester = `travel-request-user-${userId}-${firstRequest.id}`;
        console.log(`Updating existing notification for user ${userId} with key: ${notificationKeyForRequester}`);
        
        // Store the security code in the notification metadata before clearing it
        await this.notificationService.createNotification(
          user,
          `Your travel request security code has expired.`,
          NotificationType.TRAVEL_REQUEST_EXPIRED,
          { 
            notificationKey: notificationKeyForRequester, 
            travelRequestId: firstRequest.id,
            userRole: 'requester',
            expirationDate: today.toISOString(),
            status: 'expired',
            originalSecurityCode: firstRequest.securityCode // Store the original security code
          }
        );
      }
      
      // Clear security codes for expired requests but we've stored them in notification metadata
      for (const request of userRequests) {
        if (request.isCodeExpired) {
          console.log(`Clearing security code for expired travel request ID: ${request.id} (code stored in notification metadata)`);
          request.securityCode = ''; // Clear the security code to free up the pattern
          // Save the updated request
          await this.travelRequestRepository.save(request);
        }
      }
    }

    // Group requestsToClear by user to avoid sending multiple notifications to the same user
    const userClearMap = new Map<number, TravelRequest[]>();
    
    for (const request of requestsToClear) {
      // Only include requests where the end date has truly passed
      if (request.endDate < today && request.securityCode) {
        const userId = request.user.id;
        if (!userClearMap.has(userId)) {
          userClearMap.set(userId, []);
        }
        const userRequests = userClearMap.get(userId);
        if (userRequests) {
          userRequests.push(request);
        }
      } else {
        console.log(`Skipping clearing security code for travel request ID: ${request.id} as its end date has not passed yet`);
      }
    }
    
    // Process requests by user to avoid notification spam
    for (const [userId, userRequests] of userClearMap.entries()) {
      if (userRequests.length > 0) {
        const user = userRequests[0].user; // All requests in this group have the same user
        
        // Process all requests for this user
        for (const request of userRequests) {
          // Store the security code in notification metadata before clearing it
          const notificationKeyForRequest = `travel-request-user-${userId}-${request.id}`;
          await this.notificationService.createNotification(
            user,
            `Your travel period has ended and your security code has been cleared.`,
            NotificationType.TRAVEL_REQUEST_COMPLETED,
            { 
              notificationKey: notificationKeyForRequest,
              travelRequestId: request.id,
              userRole: 'requester',
              originalSecurityCode: request.securityCode // Store the original security code
            }
          );
          
          console.log(`Clearing security code for travel request ID: ${request.id}, End date: ${request.endDate.toISOString()} (code stored in notification metadata)`);
          request.securityCode = ''; // Clear the security code to free up the pattern
          request.isCodeExpired = true;
          await this.travelRequestRepository.save(request);
          clearedCount++;
        }
        
        // Get request IDs for the notification message
        const requestIds = userRequests.map(req => req.id).join(', ');
        
        // Send a single notification for all completed requests for this user
        const notificationKeyForRequester = `travel-request-user-${userId}-completed-${today.toDateString()}`;
        console.log(`Creating/updating completion notification for user ${userId} with key: ${notificationKeyForRequester}`);
        
        await this.notificationService.createNotification(
          user,
          userRequests.length === 1
            ? `Your travel period has ended and your security code has been cleared.`
            : `${userRequests.length} of your travel periods have ended and your security codes have been cleared.`,
          NotificationType.TRAVEL_REQUEST_COMPLETED,
          { 
            notificationKey: notificationKeyForRequester, 
            userRole: 'requester',
            completionDate: today.toISOString(),
            status: 'completed',
            batchProcessed: true,
            affectedRequests: requestIds
          }
        );
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
      const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
      console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
      
      await this.notificationService.createNotification(
        travelRequest.user,
        `Your travel request has been approved. Security Code: ${travelRequest.securityCode}`,
        NotificationType.TRAVEL_REQUEST_APPROVED,
        { 
          travelRequestId: travelRequest.id, 
          notificationKey: notificationKeyForRequester, 
          userRole: 'requester',
          generatedAt: new Date().toISOString(),
          status: 'approved'
        }
      );
    }

    return await this.travelRequestRepository.save(travelRequest);
  }

  async sendReceiptNotification(
    id: number, 
    message: string, 
    adminUser: User
  ): Promise<TravelRequest> {
    const travelRequest = await this.findOne(id);
    
    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }
    
    // Determine if this is from an Admin Officer
    const isAdminOfficer = adminUser.position && (
      adminUser.position.toLowerCase().includes('administrative officer') || 
      adminUser.position.toLowerCase().includes('admin officer') ||
      adminUser.role === UserRole.ADMIN
    );
    
    // Choose notification type based on who is sending it
    const notificationType = isAdminOfficer 
      ? NotificationType.CERTIFICATE_OF_APPEARANCE_APPROVED 
      : NotificationType.TRAVEL_REQUEST_APPROVED;
    
    // Create the notification with the appropriate type
    const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
    console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
    
    await this.notificationService.createNotification(
      travelRequest.user,
      message,
      notificationType,
      { 
        travelRequestId: travelRequest.id, 
        notificationKey: notificationKeyForRequester, 
        userRole: 'requester',
        adminId: adminUser.id,
        status: 'receipt'
      }
    );
    
    return travelRequest;
  }

  async findBySecurityCode(code: string, user: User): Promise<TravelRequest> {
    // Find the travel request with the given security code
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { securityCode: code },
      relations: ['user'],
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with security code ${code} not found`);
    }

    // Check if the user is authorized to view this travel request
    // Users can view their own requests or if they have appropriate roles
    if (
      travelRequest.user.id !== user.id && 
      user.role !== UserRole.ADMIN && 
      user.role !== UserRole.AO_ADMIN && 
      user.role !== UserRole.AO_ADMIN_OFFICER
    ) {
      throw new ForbiddenException('You are not authorized to view this travel request');
    }

    return travelRequest;
  }

  async findExpiredById(id: number, user: User): Promise<TravelRequest> {
    // Find the travel request by ID
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }

    // Check if the user is authorized to view this travel request
    // Users can view their own requests or if they have appropriate roles
    if (
      travelRequest.user.id !== user.id && 
      user.role !== UserRole.ADMIN && 
      user.role !== UserRole.AO_ADMIN && 
      user.role !== UserRole.AO_ADMIN_OFFICER
    ) {
      throw new ForbiddenException('You are not authorized to view this travel request');
    }
    
    // Check if this is an expired request
    if (!travelRequest.isCodeExpired) {
      throw new ForbiddenException('This endpoint is only for expired travel requests');
    }

    // Find the notification that contains the original security code
    const notification = await this.notificationService.findNotificationByTravelRequestId(travelRequest.user.id, id);
    
    if (notification) {
      // Check if this is an expired notification with the original security code
      if ((notification.type === NotificationType.TRAVEL_REQUEST_EXPIRED || 
           notification.type === NotificationType.TRAVEL_REQUEST_COMPLETED) && 
          notification.metadata) {
        try {
          const metadata = JSON.parse(notification.metadata);
          if (metadata.originalSecurityCode) {
            // Temporarily restore the security code for PDF generation
            travelRequest.securityCode = metadata.originalSecurityCode;
          }
        } catch (error) {
          console.error('Error parsing notification metadata:', error);
        }
      }
    }

    return travelRequest;
  }

  // Helper method to check if a user can validate a request based on roles
  private canUserValidateRequest(validator: User, requestor: User): boolean {
    // Principal can validate Teacher requests only (removed ASDS)
    if (validator.role === UserRole.PRINCIPAL && requestor.role === UserRole.TEACHER) {
      return true;
    }
    
    // PSDS can validate Principal requests
    if (validator.role === UserRole.PSDS && requestor.role === UserRole.PRINCIPAL) {
      return true;
    }
    
    // ASDS can validate PSDS requests
    if (validator.role === UserRole.ASDS && requestor.role === UserRole.PSDS) {
      return true;
    }
    
    // SDS can validate ASDS requests
    if (validator.role === UserRole.SDS && requestor.role === UserRole.ASDS) {
      return true;
    }
    
    // Admin, AO_ADMIN, and AO_ADMIN_OFFICER can validate any request
    if (validator.role === UserRole.ADMIN || 
        validator.role === UserRole.AO_ADMIN || 
        validator.role === UserRole.AO_ADMIN_OFFICER) {
      return true;
    }
    
    return false;
  }

  // Add this helper method to find users by role
  private async findUsersByRole(role: UserRole): Promise<User[]> {
    const entityManager = this.travelRequestRepository.manager;
    return await entityManager.find(User, {
      where: { role: role }
    });
  }

  async completeRequest(id: number, user: User): Promise<TravelRequest> {
    const travelRequest = await this.travelRequestRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!travelRequest) {
      throw new NotFoundException(`Travel request with ID ${id} not found`);
    }

    // Check if the request is validated
    if (travelRequest.validationStatus !== ValidationStatus.VALIDATED) {
      throw new ForbiddenException('Only validated requests can be completed');
    }

    // Check if the user is authorized to complete the request (AO Admin Officer)
    if (user.role !== UserRole.AO_ADMIN_OFFICER) {
      throw new ForbiddenException('Only AO Admin Officers can complete travel requests');
    }

    // Send completion notification with Certificate of Appearance availability
    const notificationKeyForRequester = `travel-request-user-${travelRequest.user.id}-${travelRequest.id}`;
    console.log(`Updating notification for requester with key: ${notificationKeyForRequester}`);
    
    await this.notificationService.createNotification(
      travelRequest.user,
      `Your travel request has been completed. You can now download your Certificate of Appearance. Security Code: ${travelRequest.securityCode}`,
      NotificationType.TRAVEL_REQUEST_COMPLETED,
      { 
        travelRequestId: travelRequest.id, 
        notificationKey: notificationKeyForRequester, 
        userRole: 'requester',
        completedBy: user.id,
        status: 'completed'
      }
    );

    return travelRequest;
  }
}