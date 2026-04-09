import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { CreateShareDto } from './shares.dto';
import { SharesService } from './shares.service';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.sharesService.mine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateShareDto) {
    return this.sharesService.create(user, body);
  }
}
