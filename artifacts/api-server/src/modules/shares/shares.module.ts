import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  controllers: [SharesController],
  providers: [SharesService, StoreService],
})
export class SharesModule {}
