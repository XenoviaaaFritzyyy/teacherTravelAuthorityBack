import { Controller, Get, Post, Put, Delete, Body, Param, HttpException, HttpStatus, Patch, UseGuards, Request } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { User } from '../entities/user.entity';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<User> {
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Post()
  async create(@Body() user: Partial<User>): Promise<User> {
    return this.userService.create(user);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() user: Partial<User>): Promise<User> {
    const updatedUser = await this.userService.update(id, user);
    if (!updatedUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return updatedUser;
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    const result = await this.userService.remove(id);
    if (!result) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id') id: number, 
    @Body() updateUserRoleDto: UpdateUserRoleDto
  ): Promise<User> {
    return this.userService.updateUserRole(id, updateUserRoleDto.role);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getDashboard() {
    return this.userService.getDashboardStats();
  }

  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AO_ADMIN)
  async resetPassword(@Param('id') id: number, @Request() req) {
    return this.userService.resetPassword(id, req.user);
  }

  @Get('ao-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AO_ADMIN)
  async getAODashboard() {
    return this.userService.getAOAdminDashboardStats();
  }
} 