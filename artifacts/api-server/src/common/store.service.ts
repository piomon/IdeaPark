import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppDatabase } from './models';
import { seedDatabase } from './seed';

@Injectable()
export class StoreService {
  private readonly filePath = join(process.cwd(), 'data', 'runtime-db.json');
  private db: AppDatabase;

  constructor() {
    const folder = join(process.cwd(), 'data');
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, JSON.stringify(seedDatabase, null, 2), 'utf-8');
    }

    const content = readFileSync(this.filePath, 'utf-8');
    this.db = JSON.parse(content) as AppDatabase;
  }

  get snapshot(): AppDatabase {
    return this.db;
  }

  save(nextDb: AppDatabase): AppDatabase {
    this.db = nextDb;
    writeFileSync(this.filePath, JSON.stringify(nextDb, null, 2), 'utf-8');
    return this.db;
  }

  update(mutator: (db: AppDatabase) => AppDatabase): AppDatabase {
    const nextDb = mutator(structuredClone(this.db));
    return this.save(nextDb);
  }

  reset(): AppDatabase {
    return this.save(structuredClone(seedDatabase));
  }
}
