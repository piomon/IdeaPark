import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';

@Module({
  controllers: [GuestsController],
  providers: [GuestsService, StoreService],
  exports: [GuestsService],
})
export class GuestsModule {}
