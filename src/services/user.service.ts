import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: number): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return null;
    }
    return user;
  }

  async create(user: Partial<User>): Promise<User> {
    try {
      const newUser = this.userRepository.create(user);
      return await this.userRepository.save(newUser);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async update(id: number, user: Partial<User>): Promise<User | null> {
    try {
      await this.userRepository.update(id, user);
      return this.findOne(id);
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async remove(id: number): Promise<boolean> {
    try {
        const result = await this.userRepository.delete(id);
        return result.affected ? result.affected > 0 : false;
    } catch (error) {
      throw new Error(`Failed to remove user: ${error.message}`);
    }
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    user.role = role;
    return this.userRepository.save(user);
  }

  async resetPassword(userId: number, aoAdmin: User): Promise<User> {
    if (aoAdmin.role !== UserRole.AO_ADMIN) {
      throw new ForbiddenException('Only AO Admins can reset passwords');
    }

    const user = await this.findOne(userId);
    if (!user || user.role !== UserRole.TEACHER) {
      throw new NotFoundException('Teacher not found');
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash('password123', 10);
    user.password = hashedPassword;
    user.requirePasswordChange = true; // Add this field to User entity
    
    return this.userRepository.save(user);
  }

  async getDashboardStats(): Promise<any> {
    const [teachers, aoAdmins, admins] = await Promise.all([
      this.userRepository.count({ where: { role: UserRole.TEACHER } }),
      this.userRepository.count({ where: { role: UserRole.AO_ADMIN } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } })
    ]);

    return {
      totalTeachers: teachers,
      totalAOAdmins: aoAdmins,
      totalAdmins: admins,
      users: await this.userRepository.find({
        select: ['id', 'username', 'first_name', 'last_name', 'role', 'school_name']
      })
    };
  }

  async getAOAdminDashboardStats(): Promise<any> {
    const teachers = await this.userRepository.find({
      where: { role: UserRole.TEACHER },
      select: ['id', 'username', 'first_name', 'last_name', 'school_name', 'employee_number']
    });

    return {
      totalTeachers: teachers.length,
      teachers
    };
  }
} 