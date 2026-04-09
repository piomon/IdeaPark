import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { query, getPool } from '../../common/db';

const BACKUP_DIR = join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 30;
const TABLES = [
  'residents',
  'sharing_entries',
  'seeking_entries',
  'proposals',
  'chat_threads',
  'chat_messages',
  'notifications',
];

export interface BackupMeta {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tables: Record<string, number>;
  adminJsonIncluded: boolean;
  trigger: 'manual' | 'scheduled';
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  startScheduler(intervalMs = 6 * 60 * 60 * 1000) {
    if (this.intervalRef) return;
    this.logger.log(`Backup scheduler started (every ${Math.round(intervalMs / 60000)} min)`);
    this.intervalRef = setInterval(() => {
      this.createBackup('scheduled').catch(err =>
        this.logger.error('Scheduled backup failed', err),
      );
    }, intervalMs);

    this.createBackup('scheduled').catch(err =>
      this.logger.error('Initial backup failed', err),
    );
  }

  stopScheduler() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
      this.logger.log('Backup scheduler stopped');
    }
  }

  async createBackup(trigger: 'manual' | 'scheduled' = 'manual'): Promise<BackupMeta> {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${ts}.json`;
    const filepath = join(BACKUP_DIR, filename);

    const backup: Record<string, any> = {
      version: 1,
      createdAt: now.toISOString(),
      trigger,
      postgres: {},
      adminJson: null,
    };

    const tableCounts: Record<string, number> = {};

    for (const table of TABLES) {
      try {
        const result = await query(`SELECT * FROM ${table}`);
        backup.postgres[table] = result.rows;
        tableCounts[table] = result.rows.length;
      } catch (err) {
        this.logger.warn(`Table ${table} backup failed: ${(err as Error).message}`);
        backup.postgres[table] = [];
        tableCounts[table] = 0;
      }
    }

    const adminJsonPath = join(process.cwd(), 'data', 'runtime-db.json');
    let adminJsonIncluded = false;
    if (existsSync(adminJsonPath)) {
      try {
        backup.adminJson = JSON.parse(readFileSync(adminJsonPath, 'utf-8'));
        adminJsonIncluded = true;
      } catch {
        this.logger.warn('Admin JSON backup failed');
      }
    }

    writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');
    const stat = statSync(filepath);

    const meta: BackupMeta = {
      filename,
      createdAt: now.toISOString(),
      sizeBytes: stat.size,
      tables: tableCounts,
      adminJsonIncluded,
      trigger,
    };

    this.logger.log(`Backup created: ${filename} (${(stat.size / 1024).toFixed(1)} KB, ${trigger})`);

    this.pruneOldBackups();

    return meta;
  }

  listBackups(): BackupMeta[] {
    if (!existsSync(BACKUP_DIR)) return [];

    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    return files.map(filename => {
      const filepath = join(BACKUP_DIR, filename);
      try {
        const stat = statSync(filepath);
        const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
        const tableCounts: Record<string, number> = {};
        if (raw.postgres) {
          for (const [table, rows] of Object.entries(raw.postgres)) {
            tableCounts[table] = Array.isArray(rows) ? rows.length : 0;
          }
        }
        return {
          filename,
          createdAt: raw.createdAt || stat.mtime.toISOString(),
          sizeBytes: stat.size,
          tables: tableCounts,
          adminJsonIncluded: !!raw.adminJson,
          trigger: raw.trigger || 'manual',
        };
      } catch {
        return {
          filename,
          createdAt: '',
          sizeBytes: 0,
          tables: {},
          adminJsonIncluded: false,
          trigger: 'manual' as const,
        };
      }
    });
  }

  async restoreBackup(filename: string): Promise<{ restored: boolean; tables: Record<string, number>; adminJsonRestored: boolean }> {
    const filepath = join(BACKUP_DIR, filename);
    if (!existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
    if (!raw.postgres || raw.version !== 1) {
      throw new Error('Invalid backup format');
    }

    const pool = getPool();
    const client = await pool.connect();
    const tableCounts: Record<string, number> = {};

    try {
      await client.query('BEGIN');

      const reverseOrder = [...TABLES].reverse();
      for (const table of reverseOrder) {
        await client.query(`DELETE FROM ${table}`);
      }

      for (const table of TABLES) {
        const rows = raw.postgres[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          tableCounts[table] = 0;
          continue;
        }

        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns.map((_, i) => `$${i + 1}`).join(', ');
          const params = columns.map(col => row[col]);
          await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT DO NOTHING`,
            params,
          );
        }
        tableCounts[table] = rows.length;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    let adminJsonRestored = false;
    if (raw.adminJson) {
      const adminJsonPath = join(process.cwd(), 'data', 'runtime-db.json');
      writeFileSync(adminJsonPath, JSON.stringify(raw.adminJson, null, 2), 'utf-8');
      adminJsonRestored = true;
    }

    this.logger.log(`Backup restored: ${filename}`);
    return { restored: true, tables: tableCounts, adminJsonRestored };
  }

  deleteBackup(filename: string): boolean {
    const filepath = join(BACKUP_DIR, filename);
    if (!existsSync(filepath)) return false;
    unlinkSync(filepath);
    this.logger.log(`Backup deleted: ${filename}`);
    return true;
  }

  private pruneOldBackups() {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort();

    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift()!;
      const filepath = join(BACKUP_DIR, oldest);
      try {
        unlinkSync(filepath);
        this.logger.log(`Pruned old backup: ${oldest}`);
      } catch {}
    }
  }
}
