import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, StoreService],
})
export class DashboardModule {}
