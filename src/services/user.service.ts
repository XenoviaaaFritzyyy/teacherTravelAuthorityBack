import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';

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

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect password');
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

  async resetPassword(userId: number, admin: User): Promise<User> {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admins can reset passwords');
    }

    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow resetting passwords for Teachers and AO Admins
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot reset Admin passwords');
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash('password123', 10);
    user.password = hashedPassword;
    user.requirePasswordChange = true;
    
    return this.userRepository.save(user);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.requirePasswordChange = false;

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
