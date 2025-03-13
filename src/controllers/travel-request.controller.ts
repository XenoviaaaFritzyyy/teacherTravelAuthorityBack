import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { TravelRequestService } from '../services/travel-request.service';
import { CreateTravelRequestDto } from '../dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from '../dto/update-travel-request.dto';
import { TravelRequestStatus } from '../entities/travel-request.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('travel-requests')
@UseGuards(JwtAuthGuard)
export class TravelRequestController {
  constructor(private readonly travelRequestService: TravelRequestService) {}

  @Post()
  create(@Body() createTravelRequestDto: CreateTravelRequestDto, @Request() req) {
    return this.travelRequestService.create(createTravelRequestDto, req.user);
  }

  @Get()
  findAll() {
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.AO_ADMIN, UserRole.ADMIN)
  findAllPendingRequests(@Request() req) {
    return this.travelRequestService.findAllPendingRequests(req.user);
  }

  @Patch(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AO_ADMIN)
  validateAndForwardToHead(@Param('id') id: string, @Request() req) {
    return this.travelRequestService.validateAndForwardToHead(+id, req.user);
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminReviewRequest(
    @Param('id') id: string,
    @Body('status') status: TravelRequestStatus,
    @Request() req,
  ) {
    return this.travelRequestService.adminReviewRequest(+id, status, req.user);
  }

  @Patch(':id/remarks')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AO_ADMIN, UserRole.ADMIN)
  addRemarks(
    @Param('id') id: string,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.travelRequestService.addRemarks(+id, remarks, req.user);
  }

  @Get('ao-admin-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AO_ADMIN)
  findAllForAOAdmin() {
    return this.travelRequestService.findAllForAOAdmin();
  }
} 