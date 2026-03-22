import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { appointments, patients, transactions } from '../db/schema.js';
import { db } from '../db/index.js';
import { eq, and, gte, lte, ne, or } from 'drizzle-orm';
import { registerCrudRoutes } from '../lib/crud-factory.js';
import { authGuard } from '../middleware/auth.js';

const createSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().default(''),
  date: z.string().min(1),
  time: z.string().min(1),
  duration: z.number().default(50),
  status: z.enum(['agendado','confirmado','em_andamento','concluido','cancelado']).default('agendado'),
  type: z.string().default(''),
  notes: z.string().optional(),
  value: z.number().optional(),
  paymentStatus: z.enum(['pendente','pago','parcial','cancelado']).optional(),
  paymentMethod: z.enum(['dinheiro','pix','cartao_credito','cartao_debito','transferencia','boleto']).optional(),
  // Recurring
  recurring: z.boolean().default(false),
  recurringWeeks: z.number().min(1).max(52).optional(),
});
const updateSchema = createSchema.omit({ recurring: true, recurringWeeks: true }).partial();

export async function appointmentRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/appointments',
    table: appointments,
    createSchema: createSchema.omit({ recurring: true, recurringWeeks: true }),
    updateSchema,
    searchColumn: 'patientName',
    beforeCreate: (data) => {
      if (!data.patientName && data.patientId) {
        const patient = db.select().from(patients).where(eq(patients.id, data.patientId)).get();
        if (patient) return { patientName: patient.name };
      }
      return {};
    },
  });

  // ── Conflict detection ────────────────────────────────────
  app.get('/api/appointments/check-conflict', { preHandler: authGuard }, async (req) => {
    const { date, time, duration = '50', excludeId } = req.query as any;
    const dur = parseInt(duration);
    const [h, m] = time.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + dur;

    const dayAppts = db.select().from(appointments).where(
      and(eq(appointments.ownerId, req.user.userId), eq(appointments.date, date),
        ne(appointments.status, 'cancelado'),
        excludeId ? ne(appointments.id, excludeId as string) : undefined as any)
    ).all().filter(Boolean);

    const conflict = dayAppts.find(a => {
      const [ah, am] = a.time.split(':').map(Number);
      const aStart = ah * 60 + am;
      const aEnd = aStart + a.duration;
      return startMin < aEnd && endMin > aStart;
    });

    return { hasConflict: !!conflict, conflictWith: conflict?.patientName || null, conflictTime: conflict?.time || null };
  });

  // ── Create with recurring ─────────────────────────────────
  app.post('/api/appointments/recurring', { preHandler: authGuard }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const { recurring, recurringWeeks, ...data } = parsed.data;
    const patient = patients.id ? db.select().from(patients).where(eq(patients.id, data.patientId)).get() : null;
    const patientName = data.patientName || patient?.name || '';
    const weeks = recurringWeeks || 1;
    const created = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(data.date + 'T12:00:00');
      d.setDate(d.getDate() + i * 7);
      const dateStr = d.toISOString().split('T')[0];
      const [item] = db.insert(appointments).values({
        ...data, patientName, date: dateStr, ownerId: req.user.userId,
      }).returning().all();
      created.push(item);
    }
    return reply.status(201).send(created);
  });

  // ── Conclude + auto-create transaction ────────────────────
  app.post('/api/appointments/:id/conclude', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const apt = db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.ownerId, req.user.userId))).get();
    if (!apt) return reply.status(404).send({ error: 'Consulta não encontrada' });

    db.update(appointments).set({ status: 'concluido' }).where(eq(appointments.id, id)).run();

    // Auto-create revenue transaction if value exists
    if (apt.value && apt.value > 0) {
      db.insert(transactions).values({
        ownerId: req.user.userId, type: 'receita', category: 'consulta',
        description: `Consulta - ${apt.patientName}`, value: apt.value,
        date: apt.date, patientId: apt.patientId, patientName: apt.patientName,
        appointmentId: apt.id, paymentMethod: apt.paymentMethod || 'pix',
        status: apt.paymentStatus || 'pendente',
      }).run();
    }
    return { ok: true, transactionCreated: !!(apt.value && apt.value > 0) };
  });

  // ── Range query ───────────────────────────────────────────
  app.get('/api/appointments/range', { preHandler: authGuard }, async (req) => {
    const { start, end } = req.query as { start: string; end: string };
    return db.select().from(appointments).where(
      and(eq(appointments.ownerId, req.user.userId), gte(appointments.date, start), lte(appointments.date, end))
    ).all();
  });

  app.get('/api/appointments/today', { preHandler: authGuard }, async (req) => {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(appointments).where(
      and(eq(appointments.ownerId, req.user.userId), eq(appointments.date, today))
    ).all();
  });
}
