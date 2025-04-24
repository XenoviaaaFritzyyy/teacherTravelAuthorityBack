import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async signUp(createUserDto: CreateUserDto): Promise<{ accessToken: string }> {
    const { password, ...rest } = createUserDto;

    try {
      // Hash the password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create the user object
      const user = this.userRepository.create({
        ...rest,
        password: hashedPassword,
      });

      // Save the user
      const savedUser = await this.userRepository.save(user);
      
      // Generate JWT token
      const payload = { email: savedUser.email, sub: savedUser.id };
      const accessToken = this.jwtService.sign(payload);
      
      return { accessToken };
    } catch (error) {
      console.error('Signup error:', error); // Add detailed error logging
      
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email already exists');
      }
      
      // Add more specific error handling
      if (error.message) {
        throw new InternalServerErrorException(error.message);
      }
      
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    // First find user with password field explicitly selected
    const user = await this.userRepository
        .createQueryBuilder('user')
        .where('user.email = :email', { email })
        .addSelect('user.password')
        .getOne();

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    // Get full user data without password
    const { password: _, ...result } = user;
    return result;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}