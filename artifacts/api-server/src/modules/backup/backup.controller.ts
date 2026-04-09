import { Controller, Get, Post, Delete, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../../common/auth.guard';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  async createBackup() {
    try {
      const meta = await this.backupService.createBackup('manual');
      return { success: true, backup: meta };
    } catch (err) {
      throw new HttpException(
        `Backup failed: ${(err as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('list')
  listBackups() {
    return { backups: this.backupService.listBackups() };
  }

  @Post('restore/:filename')
  async restoreBackup(@Param('filename') filename: string) {
    if (!filename.startsWith('backup_') || !filename.endsWith('.json')) {
      throw new HttpException('Invalid backup filename', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.backupService.restoreBackup(filename);
      return { success: true, ...result };
    } catch (err) {
      throw new HttpException(
        `Restore failed: ${(err as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':filename')
  deleteBackup(@Param('filename') filename: string) {
    if (!filename.startsWith('backup_') || !filename.endsWith('.json')) {
      throw new HttpException('Invalid backup filename', HttpStatus.BAD_REQUEST);
    }
    const deleted = this.backupService.deleteBackup(filename);
    if (!deleted) {
      throw new HttpException('Backup not found', HttpStatus.NOT_FOUND);
    }
    return { success: true, deleted: filename };
  }
}
