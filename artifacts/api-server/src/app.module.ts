import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { SharesModule } from './modules/shares/shares.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { GuestsModule } from './modules/guests/guests.module';
import { AccessModule } from './modules/access/access.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';
import { ResidentModule } from './modules/resident/resident.module';
import { BackupModule } from './modules/backup/backup.module';
import { JwtAuthGuard } from './common/auth.guard';

@Module({
  imports: [
    AuthModule,
    DashboardModule,
    SpacesModule,
    SharesModule,
    ReservationsModule,
    GuestsModule,
    AccessModule,
    AdminModule,
    ReportsModule,
    HealthModule,
    ResidentModule,
    BackupModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
