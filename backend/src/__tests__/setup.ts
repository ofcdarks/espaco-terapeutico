import { db, sqlite } from '../db/index.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
// Use in-memory DB for tests
beforeAll(() => { try { migrate(db, { migrationsFolder: './drizzle' }); } catch {} });
afterAll(() => { sqlite.close(); });
