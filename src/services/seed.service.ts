import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedAdminUser();
  }

  private async seedAdminUser() {
    // Check if admin already exists
    const adminExists = await this.userRepository.findOne({
      where: { email: 'admin@gmail.com' }
    });

    if (!adminExists) {
      // Hash the default password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash('admin123', salt);

      // Create admin user
      const adminUser = this.userRepository.create({
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        first_name: 'System',
        last_name: 'Admin',
        school_id: 'ADMIN',
        school_name: 'System',
        district: 'System',
        position: 'System Administrator',
        contact_no: 'N/A',
        employee_number: 'ADMIN',
        requirePasswordChange: false
      });

      await this.userRepository.save(adminUser);
      console.log('Default admin account created');
    }
  }
}