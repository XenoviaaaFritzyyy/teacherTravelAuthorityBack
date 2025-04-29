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
      where: { email: 'emmanuel.mendoza002@deped.gov.ph' }
    });

    if (!adminExists) {
      // Hash the default password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash('@Password123', salt);

      // Create admin user
      const adminUser = this.userRepository.create({
        email: 'emmanuel.mendoza002@deped.gov.ph',
        password: hashedPassword,
        role: UserRole.ADMIN,
        first_name: 'Emmanuel',
        last_name: 'Mendoza',
        school_id: 'ADMIN',
        school_name: 'System',
        district: 'System',
        position: 'Information Technology Officer',
        contact_no: 'N/A',
        employee_number: 'ADMIN',
        requirePasswordChange: false
      });

      await this.userRepository.save(adminUser);
      console.log('Default admin account created');
    }
  }
}