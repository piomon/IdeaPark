import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, StoreService],
})
export class ReservationsModule {}
