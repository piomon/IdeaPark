import { Controller, Get, Post } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { Public } from '../../common/auth.guard';

@Controller()
export class HealthController {
  constructor(private readonly store: StoreService) {}

  @Public()
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'IdeaPark API',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reset')
  reset() {
    this.store.reset();
    return {
      ok: true,
      message: 'Demo database reset',
    };
  }
}
