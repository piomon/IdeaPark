import { Module, OnModuleInit } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule implements OnModuleInit {
  constructor(private readonly backupService: BackupService) {}

  onModuleInit() {
    this.backupService.startScheduler(6 * 60 * 60 * 1000);
  }
}
