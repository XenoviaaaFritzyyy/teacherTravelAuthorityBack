import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, InternalServerErrorException, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { TravelRequestService } from '../services/travel-request.service';
import { CreateTravelRequestDto } from '../dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from '../dto/update-travel-request.dto';
import { TravelRequestStatus, ValidationStatus } from '../entities/travel-request.entity';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.travelRequestService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTravelRequestDto: UpdateTravelRequestDto) {
    return this.travelRequestService.update(+id, updateTravelRequestDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TravelRequestStatus,
  ) {
    return this.travelRequestService.updateStatus(+id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.travelRequestService.remove(+id);
  }

  @Get('pending')
  findAllPendingRequests(@Request() req) {
    return this.travelRequestService.findAllPendingRequests(req.user);
  }

  @Patch(':id/validate')
  async validateRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body('validationStatus') validationStatus: ValidationStatus,
    @Request() req
  ) {
    try {
      return await this.travelRequestService.validateRequest(
        id, 
        validationStatus || ValidationStatus.VALIDATED,
        req.user
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
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