import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return { success: true, data: await this.authService.register(registerDto) };
  }


  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return { success: true, data: await this.authService.login(loginDto) };
  }
}
