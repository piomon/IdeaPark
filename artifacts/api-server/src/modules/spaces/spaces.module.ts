import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  controllers: [SpacesController],
  providers: [SpacesService, StoreService],
  exports: [SpacesService],
})
export class SpacesModule {}
