import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sqlite } from '../db/index.js';
import { db } from '../db/index.js';
import { appointments, patients } from '../db/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function schedulingRoutes(app: FastifyInstance) {
  // Create availability table
  sqlite.exec(`CREATE TABLE IF NOT EXISTS availability (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_duration INTEGER NOT NULL DEFAULT 50,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS scheduling_config (
    owner_id TEXT PRIMARY KEY,
    is_enabled INTEGER DEFAULT 0,
    slug TEXT,
    whatsapp TEXT,
    min_advance_days INTEGER DEFAULT 1,
    max_advance_days INTEGER DEFAULT 30,
    welcome_message TEXT DEFAULT 'Escolha um horário disponível.',
    confirmation_type TEXT DEFAULT 'whatsapp'
  )`);

  // ── Therapist: manage availability ──
  app.get('/api/scheduling/availability', { preHandler: authGuard }, async (req) => {
    return sqlite.prepare('SELECT * FROM availability WHERE owner_id = ? ORDER BY day_of_week, start_time').all(req.user.userId);
  });

  app.post('/api/scheduling/availability', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
      slotDuration: z.number().default(50),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const id = Math.random().toString(36).slice(2, 10);
    const { dayOfWeek, startTime, endTime, slotDuration } = parsed.data;
    sqlite.prepare('INSERT INTO availability (id, owner_id, day_of_week, start_time, end_time, slot_duration) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.user.userId, dayOfWeek, startTime, endTime, slotDuration);
    return { id, ...parsed.data };
  });

  app.delete('/api/scheduling/availability/:id', { preHandler: authGuard }, async (req) => {
    sqlite.prepare('DELETE FROM availability WHERE id = ? AND owner_id = ?').run((req.params as any).id, req.user.userId);
    return { ok: true };
  });

  // ── Therapist: config ──
  app.get('/api/scheduling/config', { preHandler: authGuard }, async (req) => {
    return sqlite.prepare('SELECT * FROM scheduling_config WHERE owner_id = ?').get(req.user.userId) || { isEnabled: 0, slug: '', whatsapp: '', minAdvanceDays: 1, maxAdvanceDays: 30, welcomeMessage: '', confirmationType: 'whatsapp' };
  });

  app.post('/api/scheduling/config', { preHandler: authGuard }, async (req) => {
    const { isEnabled, slug, whatsapp, minAdvanceDays, maxAdvanceDays, welcomeMessage, confirmationType } = req.body as any;
    const existing = sqlite.prepare('SELECT 1 FROM scheduling_config WHERE owner_id = ?').get(req.user.userId);
    if (existing) {
      sqlite.prepare('UPDATE scheduling_config SET is_enabled=?, slug=?, whatsapp=?, min_advance_days=?, max_advance_days=?, welcome_message=?, confirmation_type=? WHERE owner_id=?')
        .run(isEnabled ? 1 : 0, slug || '', whatsapp || '', minAdvanceDays || 1, maxAdvanceDays || 30, welcomeMessage || '', confirmationType || 'whatsapp', req.user.userId);
    } else {
      sqlite.prepare('INSERT INTO scheduling_config (owner_id, is_enabled, slug, whatsapp, min_advance_days, max_advance_days, welcome_message, confirmation_type) VALUES (?,?,?,?,?,?,?,?)')
        .run(req.user.userId, isEnabled ? 1 : 0, slug || '', whatsapp || '', minAdvanceDays || 1, maxAdvanceDays || 30, welcomeMessage || '', confirmationType || 'whatsapp');
    }
    return { ok: true };
  });

  // ── Public: get available slots for a date range ──
  app.get('/api/scheduling/public/:slug/slots', async (req, reply) => {
    const { slug } = req.params as any;
    const { from, to } = req.query as any;
    const config = sqlite.prepare('SELECT * FROM scheduling_config WHERE slug = ? AND is_enabled = 1').get(slug) as any;
    if (!config) return reply.status(404).send({ error: 'Agenda não encontrada' });

    const avail = sqlite.prepare('SELECT * FROM availability WHERE owner_id = ? AND is_active = 1 ORDER BY day_of_week, start_time').all(config.owner_id) as any[];

    // Get existing appointments in date range
    const existingAppts = db.select().from(appointments)
      .where(and(eq(appointments.ownerId, config.owner_id), gte(appointments.date, from || ''), lte(appointments.date, to || '')))
      .all();

    const bookedSlots = new Set(existingAppts.map((a: any) => `${a.date}_${a.time}`));

    // Generate slots for each day in range
    const slots: { date: string; time: string; duration: number }[] = [];
    const startDate = new Date(from || new Date().toISOString().split('T')[0]);
    const endDate = new Date(to || new Date(Date.now() + config.max_advance_days * 86400000).toISOString().split('T')[0]);
    const minDate = new Date(Date.now() + config.min_advance_days * 86400000);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d < minDate) continue;
      const dow = d.getDay();
      const dateStr = d.toISOString().split('T')[0];

      for (const a of avail) {
        if (a.day_of_week !== dow) continue;
        // Generate time slots
        const [sh, sm] = a.start_time.split(':').map(Number);
        const [eh, em] = a.end_time.split(':').map(Number);
        let mins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        while (mins + a.slot_duration <= endMins) {
          const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
          if (!bookedSlots.has(`${dateStr}_${time}`)) {
            slots.push({ date: dateStr, time, duration: a.slot_duration });
          }
          mins += a.slot_duration;
        }
      }
    }

    return { config: { welcomeMessage: config.welcome_message, whatsapp: config.whatsapp }, slots };
  });

  // ── Public: book a slot ──
  app.post('/api/scheduling/public/:slug/book', async (req, reply) => {
    const { slug } = req.params as any;
    const config = sqlite.prepare('SELECT * FROM scheduling_config WHERE slug = ? AND is_enabled = 1').get(slug) as any;
    if (!config) return reply.status(404).send({ error: 'Agenda não encontrada' });

    const parsed = z.object({ date: z.string(), time: z.string(), name: z.string().min(2), phone: z.string().optional(), email: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const { date, time, name, phone, email } = parsed.data;

    // Check if slot is still available
    const existing = db.select().from(appointments).where(and(eq(appointments.ownerId, config.owner_id), eq(appointments.date, date), eq(appointments.time, time))).get();
    if (existing) return reply.status(409).send({ error: 'Horário não disponível' });

    // Find or create patient
    let patient: any = null;
    if (email) patient = db.select().from(patients).where(and(eq(patients.ownerId, config.owner_id), eq(patients.email, email))).get();
    if (!patient && phone) patient = db.select().from(patients).where(and(eq(patients.ownerId, config.owner_id), eq(patients.phone, phone))).get();

    if (!patient) {
      const [p] = db.insert(patients).values({ name, email: email || '', phone: phone || '', ownerId: config.owner_id }).returning().all();
      patient = p;
    }

    // Create appointment
    const [appt] = db.insert(appointments).values({
      patientId: patient.id, patientName: name, date, time, duration: 50,
      type: 'consulta', status: 'aguardando', ownerId: config.owner_id,
    }).returning().all();

    return { ok: true, appointment: appt, whatsapp: config.whatsapp };
  });
}
