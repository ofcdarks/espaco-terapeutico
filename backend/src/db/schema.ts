import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  category: text('category', { enum: ['terapeuta', 'sexologo', 'psicologo', 'psicanalista', 'constelador'] }).notNull().default('psicologo'),
  phone: text('phone').default(''),
  bio: text('bio'),
  registrationNumber: text('registration_number'),
  specialty: text('specialty'),
  approaches: text('approaches'),
  sessionDuration: integer('session_duration').default(50),
  sessionPrice: real('session_price'),
  clinicName: text('clinic_name'),
  clinicAddress: text('clinic_address'),
  clinicCity: text('clinic_city'),
  clinicState: text('clinic_state'),
  onlineService: integer('online_service', { mode: 'boolean' }).default(true),
  inPersonService: integer('in_person_service', { mode: 'boolean' }).default(false),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false),
  stripeCustomerId: text('stripe_customer_id'),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ emailIdx: index('users_email_idx').on(t.email) }));

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  birthDate: text('birth_date').default(''),
  cpf: text('cpf').default(''),
  address: text('address'),
  notes: text('notes'),
  status: text('status', { enum: ['ativo', 'inativo'] }).notNull().default('ativo'),
  packageId: text('package_id'),
  sessionsRemaining: integer('sessions_remaining'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('patients_owner_idx').on(t.ownerId),
  ownerNameIdx: index('patients_owner_name_idx').on(t.ownerId, t.name),
}));

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  patientName: text('patient_name').notNull().default(''),
  date: text('date').notNull(),
  time: text('time').notNull(),
  duration: integer('duration').notNull().default(50),
  status: text('status', { enum: ['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado'] }).notNull().default('agendado'),
  type: text('type').notNull().default(''),
  notes: text('notes'),
  value: real('value'),
  paymentStatus: text('payment_status', { enum: ['pendente', 'pago', 'parcial', 'cancelado'] }),
  paymentMethod: text('payment_method', { enum: ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'boleto'] }),
  reminderSent1h: integer('reminder_sent_1h', { mode: 'boolean' }).default(false),
  reminderSent24h: integer('reminder_sent_24h', { mode: 'boolean' }).default(false),
  reminderSent1hAt: text('reminder_sent_1h_at'),
  reminderSent24hAt: text('reminder_sent_24h_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('appt_owner_idx').on(t.ownerId),
  ownerDateIdx: index('appt_owner_date_idx').on(t.ownerId, t.date),
  patientIdx: index('appt_patient_idx').on(t.patientId),
  reminderIdx: index('appt_reminder_idx').on(t.status, t.reminderSent1h, t.reminderSent24h),
}));

export const records = sqliteTable('records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appointmentId: text('appointment_id').references(() => appointments.id),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  patientName: text('patient_name').notNull().default(''),
  date: text('date').notNull(),
  diagnosis: text('diagnosis'),
  treatment: text('treatment'),
  observations: text('observations'),
  prescriptions: text('prescriptions'),
  attachments: text('attachments'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('records_owner_idx').on(t.ownerId),
  patientIdx: index('records_patient_idx').on(t.patientId),
}));

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['receita', 'despesa'] }).notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  category: text('category', { enum: ['consulta', 'pacote', 'produto', 'outros_receita', 'aluguel', 'salario', 'material', 'marketing', 'software', 'outros_despesa'] }).notNull(),
  description: text('description').notNull().default(''),
  value: real('value').notNull().default(0),
  date: text('date').notNull(),
  patientId: text('patient_id').references(() => patients.id),
  patientName: text('patient_name'),
  appointmentId: text('appointment_id').references(() => appointments.id),
  paymentMethod: text('payment_method', { enum: ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'boleto'] }),
  status: text('status', { enum: ['pendente', 'pago', 'parcial', 'cancelado'] }).notNull().default('pendente'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('tx_owner_idx').on(t.ownerId),
  ownerDateIdx: index('tx_owner_date_idx').on(t.ownerId, t.date),
  ownerTypeIdx: index('tx_owner_type_idx').on(t.ownerId, t.type, t.status),
}));

export const packages = sqliteTable('packages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sessions: integer('sessions').notNull().default(1),
  value: real('value').notNull().default(0),
  validity: integer('validity').notNull().default(30),
  stripePriceId: text('stripe_price_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ ownerIdx: index('pkg_owner_idx').on(t.ownerId) }));

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['recibo', 'atestado', 'declaracao', 'relatorio', 'receituario'] }).notNull(),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  patientName: text('patient_name').notNull().default(''),
  appointmentId: text('appointment_id').references(() => appointments.id),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('docs_owner_idx').on(t.ownerId),
  patientIdx: index('docs_patient_idx').on(t.patientId),
}));

export const patientGroups = sqliteTable('patient_groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['familia', 'casal', 'grupo_terapeutico'] }).notNull().default('familia'),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ ownerIdx: index('pg_owner_idx').on(t.ownerId) }));

export const patientGroupMembers = sqliteTable('patient_group_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull().references(() => patientGroups.id, { onDelete: 'cascade' }),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
}, (t) => ({
  groupIdx: index('pgm_group_idx').on(t.groupId),
  patientIdx: index('pgm_patient_idx').on(t.patientId),
}));

export const patientRelationships = sqliteTable('patient_relationships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  relatedPatientId: text('related_patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  relationship: text('relationship', { enum: ['conjuge', 'pai', 'mae', 'filho', 'filha', 'irmao', 'irma', 'parceiro', 'parceira', 'outro'] }).notNull().default('outro'),
  groupId: text('group_id').references(() => patientGroups.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('pr_owner_idx').on(t.ownerId),
  patientIdx: index('pr_patient_idx').on(t.patientId),
}));

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ userIdx: index('push_user_idx').on(t.userId) }));

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdx: index('rt_user_idx').on(t.userId),
  hashIdx: index('rt_hash_idx').on(t.tokenHash),
}));

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ hashIdx: index('prt_hash_idx').on(t.tokenHash) }));

// ============================================================
// IN-APP NOTIFICATIONS
// ============================================================
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type', { enum: ['appointment_reminder', 'appointment_cancelled', 'payment_received', 'patient_birthday', 'system'] }).notNull().default('system'),
  readAt: text('read_at'),
  data: text('data'), // JSON
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdx: index('notif_user_idx').on(t.userId),
  unreadIdx: index('notif_unread_idx').on(t.userId, t.readAt),
}));

// ============================================================
// PATIENT CONSENT (LGPD)
// ============================================================
export const patientConsents = sqliteTable('patient_consents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['tratamento', 'dados_pessoais', 'teleconsulta', 'compartilhamento'] }).notNull(),
  consentedAt: text('consented_at').notNull(),
  revokedAt: text('revoked_at'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  patientIdx: index('consent_patient_idx').on(t.patientId),
}));

// ============================================================
// WHATSAPP CONFIG
// ============================================================
export const whatsappConfig = sqliteTable('whatsapp_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  apiUrl: text('api_url').notNull(), // Evolution API / Z-API URL
  apiKey: text('api_key').notNull(),
  instanceName: text('instance_name').notNull().default('default'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  reminderTemplate: text('reminder_template').default('Olá {paciente}! Lembramos da sua consulta amanhã, {data} às {hora}. Confirme sua presença respondendo esta mensagem. 😊'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// DOCUMENT TEMPLATES
// ============================================================
export const documentTemplates = sqliteTable('document_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['recibo', 'atestado', 'declaracao', 'relatorio', 'receituario'] }).notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(), // Template with {variables}
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('dt_owner_idx').on(t.ownerId),
}));

// ============================================================
// AUDIT LOG
// ============================================================
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // create, update, delete, login, export
  entity: text('entity').notNull(), // patients, appointments, etc
  entityId: text('entity_id'),
  details: text('details'), // JSON with changes
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdx: index('audit_user_idx').on(t.userId),
  entityIdx: index('audit_entity_idx').on(t.entity, t.entityId),
}));

// ============================================================
// SYSTEM CONFIG (admin-only, singleton per key)
// ============================================================
export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// PLANS (SaaS subscription plans)
// ============================================================
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull().default(0),
  interval: text('interval', { enum: ['monthly', 'yearly', 'lifetime'] }).notNull().default('monthly'),
  maxPatients: integer('max_patients').default(-1), // -1 = unlimited
  maxAppointmentsMonth: integer('max_appointments_month').default(-1),
  hasAI: integer('has_ai', { mode: 'boolean' }).default(false),
  hasTelehealth: integer('has_telehealth', { mode: 'boolean' }).default(false),
  hasWhatsapp: integer('has_whatsapp', { mode: 'boolean' }).default(false),
  hasTranscription: integer('has_transcription', { mode: 'boolean' }).default(false),
  stripePriceId: text('stripe_price_id'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ============================================================
// USER SUBSCRIPTIONS
// ============================================================
export const userSubscriptions = sqliteTable('user_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  status: text('status', { enum: ['active', 'cancelled', 'expired', 'trial'] }).notNull().default('trial'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdx: index('sub_user_idx').on(t.userId),
}));

// ============================================================
// SESSION TRANSCRIPTS
// ============================================================
export const sessionTranscripts = sqliteTable('session_transcripts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appointmentId: text('appointment_id').references(() => appointments.id),
  patientId: text('patient_id').references(() => patients.id),
  patientName: text('patient_name').default(''),
  transcript: text('transcript').notNull(),
  duration: integer('duration'), // seconds
  aiAnalysis: text('ai_analysis'), // JSON from AI
  provider: text('provider', { enum: ['web_speech', 'downsub', 'manual'] }).default('web_speech'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('transcript_owner_idx').on(t.ownerId),
  patientIdx: index('transcript_patient_idx').on(t.patientId),
}));

// ============================================================
// CONTRACTS (contratos terapêuticos)
// ============================================================
export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: text('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  patientName: text('patient_name').notNull().default(''),
  templateId: text('template_id'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['rascunho', 'enviado', 'assinado', 'cancelado'] }).notNull().default('rascunho'),
  sentAt: text('sent_at'),
  signedAt: text('signed_at'),
  signatureHash: text('signature_hash'), // SHA-256 of patient name + timestamp
  signatureIp: text('signature_ip'),
  validUntil: text('valid_until'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('contracts_owner_idx').on(t.ownerId),
  patientIdx: index('contracts_patient_idx').on(t.patientId),
  statusIdx: index('contracts_status_idx').on(t.ownerId, t.status),
}));

// ============================================================
// CONTRACT TEMPLATES
// ============================================================
export const contractTemplates = sqliteTable('contract_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['terapia_individual', 'terapia_casal', 'terapia_grupo', 'teleconsulta', 'lgpd', 'personalizado'] }).notNull().default('terapia_individual'),
  content: text('content').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  ownerIdx: index('ct_owner_idx').on(t.ownerId),
}));

export const registrationLinks = sqliteTable('registration_links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull().default(''),
  usedAt: text('used_at'),
  patientId: text('patient_id'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
