import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.adminService.overview(user);
  }

  @Get('spaces')
  spaces(@CurrentUser() user: AuthUser) {
    return this.adminService.spaces(user);
  }

  @Get('reservations')
  reservations(@CurrentUser() user: AuthUser) {
    return this.adminService.reservations(user);
  }

  @Get('guests')
  guests(@CurrentUser() user: AuthUser) {
    return this.adminService.guests(user);
  }
}
