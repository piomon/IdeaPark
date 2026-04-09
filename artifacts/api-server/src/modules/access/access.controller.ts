import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { OpenGateDto } from './access.dto';
import { AccessService } from './access.service';

@Controller('access')
@UseGuards(JwtAuthGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() body: OpenGateDto) {
    return this.accessService.openGate(user, body.gateName);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.accessService.history(user);
  }
}
