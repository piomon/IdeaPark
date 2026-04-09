import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, StoreService],
})
export class ReportsModule {}
