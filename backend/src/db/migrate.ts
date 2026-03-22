import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_URL || './data/espaco.db';
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Creating tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    category TEXT NOT NULL DEFAULT 'psicologo',
    phone TEXT DEFAULT '',
    bio TEXT,
    registration_number TEXT,
    specialty TEXT,
    approaches TEXT,
    session_duration INTEGER DEFAULT 50,
    session_price REAL,
    clinic_name TEXT,
    clinic_address TEXT,
    clinic_city TEXT,
    clinic_state TEXT,
    online_service INTEGER DEFAULT 1,
    in_person_service INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    birth_date TEXT DEFAULT '',
    cpf TEXT DEFAULT '',
    address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    package_id TEXT,
    sessions_remaining INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'agendado',
    type TEXT NOT NULL DEFAULT '',
    notes TEXT,
    value REAL,
    payment_status TEXT,
    payment_method TEXT,
    reminder_sent_1h INTEGER DEFAULT 0,
    reminder_sent_24h INTEGER DEFAULT 0,
    reminder_sent_1h_at TEXT,
    reminder_sent_24h_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id),
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    diagnosis TEXT,
    treatment TEXT,
    observations TEXT,
    prescriptions TEXT,
    attachments TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    value REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    patient_id TEXT REFERENCES patients(id),
    patient_name TEXT,
    appointment_id TEXT REFERENCES appointments(id),
    payment_method TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sessions INTEGER NOT NULL DEFAULT 1,
    value REAL NOT NULL DEFAULT 0,
    validity INTEGER NOT NULL DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,
    stripe_price_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL DEFAULT '',
    appointment_id TEXT REFERENCES appointments(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patient_groups (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'familia',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patient_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES patient_groups(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS patient_relationships (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    related_patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'outro',
    group_id TEXT REFERENCES patient_groups(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    read_at TEXT,
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patient_consents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    consented_at TEXT NOT NULL,
    revoked_at TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS whatsapp_config (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    instance_name TEXT NOT NULL DEFAULT 'default',
    enabled INTEGER NOT NULL DEFAULT 1,
    reminder_template TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS document_templates (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    interval TEXT NOT NULL DEFAULT 'monthly',
    max_patients INTEGER DEFAULT -1,
    max_appointments_month INTEGER DEFAULT -1,
    has_ai INTEGER DEFAULT 0,
    has_telehealth INTEGER DEFAULT 0,
    has_whatsapp INTEGER DEFAULT 0,
    has_transcription INTEGER DEFAULT 0,
    stripe_price_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'trial',
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_transcripts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id),
    patient_id TEXT REFERENCES patients(id),
    patient_name TEXT DEFAULT '',
    transcript TEXT NOT NULL,
    duration INTEGER,
    ai_analysis TEXT,
    provider TEXT DEFAULT 'web_speech',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL DEFAULT '',
    template_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    sent_at TEXT,
    signed_at TEXT,
    signature_hash TEXT,
    signature_ip TEXT,
    valid_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contract_templates (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'terapia_individual',
    content TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_id);
  CREATE INDEX IF NOT EXISTS idx_patients_owner_name ON patients(owner_id, name);
  CREATE INDEX IF NOT EXISTS idx_appointments_owner ON appointments(owner_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_owner_date ON appointments(owner_id, date);
  CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_records_owner ON records(owner_id);
  CREATE INDEX IF NOT EXISTS idx_records_patient ON records(patient_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_owner ON transactions(owner_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_owner_date ON transactions(owner_id, date);
  CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
  CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_patient ON contracts(patient_id);
  CREATE INDEX IF NOT EXISTS idx_session_transcripts_owner ON session_transcripts(owner_id);
`);

console.log('Database ready.');

// ── Add missing columns to existing tables (safe to run multiple times) ──
const alterStatements = [
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN two_factor_secret TEXT",
  "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
  "ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0",
  "ALTER TABLE plans ADD COLUMN stripe_price_id TEXT",
  "ALTER TABLE user_subscriptions ADD COLUMN stripe_subscription_id TEXT",
  "ALTER TABLE user_subscriptions ADD COLUMN stripe_price_id TEXT",
  "ALTER TABLE packages ADD COLUMN stripe_price_id TEXT",
];

for (const stmt of alterStatements) {
  try { db.exec(stmt); } catch (e: any) {
    // "duplicate column name" is expected if column already exists
    if (!e.message?.includes('duplicate column')) {
      console.warn(`Note: ${e.message}`);
    }
  }
}

console.log('Migrations applied.');
db.close();
