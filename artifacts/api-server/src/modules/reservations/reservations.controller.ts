import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { CreateReservationDto } from './reservations.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.reservationsService.mine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateReservationDto) {
    return this.reservationsService.create(user, body);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservationsService.cancel(user, id);
  }
}
