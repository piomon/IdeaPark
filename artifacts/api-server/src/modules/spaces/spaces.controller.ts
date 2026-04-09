import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthUser } from '../../common/models';
import { SpacesService } from './spaces.service';

@Controller('spaces')
@UseGuards(JwtAuthGuard)
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('from') from = '',
    @Query('to') to = '',
  ) {
    return this.spacesService.list(user, from, to);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.spacesService.mine(user);
  }

  @Get(':id')
  byId(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.byId(user, id);
  }
}
