import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from '../../common/auth.guard';
import { LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { JwtPayload } from '../../common/jwt';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.authService.me(user.userId);
  }
}
