import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_URL || './data/espaco.db';

// Ensure data directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Performance and safety settings for production
sqlite.pragma('journal_mode = WAL');        // Concurrent reads + writes
sqlite.pragma('busy_timeout = 5000');       // Wait 5s on lock instead of failing
sqlite.pragma('synchronous = NORMAL');      // Good balance of speed vs durability
sqlite.pragma('cache_size = -64000');       // 64MB cache
sqlite.pragma('foreign_keys = ON');         // Enforce FK constraints
sqlite.pragma('temp_store = MEMORY');       // Temp tables in RAM

export const db = drizzle(sqlite, { schema });
export { sqlite };
