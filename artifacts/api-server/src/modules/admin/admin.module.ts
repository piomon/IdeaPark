import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { GuestsModule } from '../guests/guests.module';
import { SpacesModule } from '../spaces/spaces.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SpacesService } from '../spaces/spaces.service';
import { GuestsService } from '../guests/guests.service';

@Module({
  imports: [SpacesModule, GuestsModule],
  controllers: [AdminController],
  providers: [AdminService, StoreService, SpacesService, GuestsService],
})
export class AdminModule {}
