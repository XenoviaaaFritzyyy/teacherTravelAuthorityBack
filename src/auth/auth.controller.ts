import { Body, Controller, Post, UseGuards, Get, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../entities/user.entity';
import { GetUser } from './get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/signup')
  async signUp(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUp(createUserDto);
  }

  @Post('/signin')
  @UseGuards(AuthGuard('local'))
  async signIn(@GetUser() user: User) {
    return this.authService.login(user);
  }

  @Get('/check-email')
  async checkEmailExists(@Query('email') email: string) {
    return this.authService.checkEmailExists(email);
  }
}