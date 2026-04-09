import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { CreateGuestDto } from './guests.dto';
import { GuestsService } from './guests.service';

@Controller('guests')
@UseGuards(JwtAuthGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.guestsService.mine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateGuestDto) {
    return this.guestsService.create(user, body);
  }
}
