import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [StoreService],
})
export class HealthModule {}
