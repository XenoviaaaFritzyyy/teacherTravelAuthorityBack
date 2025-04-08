import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, InternalServerErrorException, ParseIntPipe, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TravelRequestService } from '../services/travel-request.service';
import { CreateTravelRequestDto } from '../dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from '../dto/update-travel-request.dto';
import { TravelRequestStatus, ValidationStatus, TravelRequest } from '../entities/travel-request.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('travel-requests')
@UseGuards(JwtAuthGuard)
export class TravelRequestController {
  constructor(private readonly travelRequestService: TravelRequestService) {}

  @Post()
  create(@Body() createTravelRequestDto: CreateTravelRequestDto, @Request() req) {
    return this.travelRequestService.create(createTravelRequestDto, req.user);
  }

  @Get()
  async findAll() {
    return this.travelRequestService.findAll();
  }

  // IMPORTANT: Specific routes must come before parameterized routes
  @Get('pending')
  async findAllPendingRequests(@Request() req) {
    try {
      return await this.travelRequestService.findAllPendingRequests(req.user);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to fetch pending requests: ${error.message}`);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.travelRequestService.findOne(+id);
  }

  @Get('by-code/:code')
  async findBySecurityCode(
    @Param('code') code: string,
    @Request() req
  ) {
    try {
      return await this.travelRequestService.findBySecurityCode(code, req.user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to fetch travel request: ${error.message}`);
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTravelRequestDto: UpdateTravelRequestDto) {
    return this.travelRequestService.update(+id, updateTravelRequestDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: TravelRequestStatus,
  ): Promise<TravelRequest> {
    return await this.travelRequestService.updateStatus(id, status);
  }

  @Patch(':id/viewed')
  async markAsViewed(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TravelRequest> {
    return await this.travelRequestService.markAsViewed(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.travelRequestService.remove(+id);
  }

  @Patch(':id/validate')
  async validateRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body('validationStatus') validationStatus: ValidationStatus,
    @Request() req
  ) {
    try {
      // Default to VALIDATED if not specified
      const status = validationStatus || ValidationStatus.VALIDATED;
      
      return await this.travelRequestService.validateRequest(
        id, 
        status,
        req.user
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Patch(':id/review')
  adminReviewRequest(
    @Param('id') id: string,
    @Body('status') status: TravelRequestStatus,
    @Request() req,
  ) {
    return this.travelRequestService.adminReviewRequest(+id, status, req.user);
  }

  @Patch(':id/remarks')
  async addRemarks(
    @Param('id', ParseIntPipe) id: number,
    @Body('remarks') remarks: string,
    @Request() req
  ) {
    try {
      return await this.travelRequestService.addRemarks(id, remarks, req.user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post(':id/receipt')
  async sendReceiptNotification(
    @Param('id', ParseIntPipe) id: number,
    @Body('message') message: string,
    @Request() req
  ) {
    try {
      return await this.travelRequestService.sendReceiptNotification(id, message, req.user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post(':id/generate-security-code')
  @UseGuards(JwtAuthGuard)
  async generateSecurityCode(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.travelRequestService.generateSecurityCodeForAcceptedRequest(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post('check-expired-codes')
  @UseGuards(JwtAuthGuard)
  async checkExpiredCodes() {
    try {
      return await this.travelRequestService.checkAndUpdateExpiredCodes();
    } catch (error) {
      throw new InternalServerErrorException(`Failed to check expired codes: ${error.message}`);
    }
  }
}