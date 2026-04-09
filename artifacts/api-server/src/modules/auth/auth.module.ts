import { Module } from '@nestjs/common';
import { StoreService } from '../../common/store.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, StoreService],
  exports: [AuthService],
})
export class AuthModule {}
