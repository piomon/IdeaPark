import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  controllers: [AccessController],
  providers: [AccessService, StoreService],
})
export class AccessModule {}
