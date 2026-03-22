import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  users, patients, appointments, transactions, plans, userSubscriptions,
  systemConfig, sessionTranscripts, auditLog, notifications,
} from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { adminGuard } from '../middleware/admin.js';
import { hashPassword } from '../lib/auth.js';

export async function adminRoutes(app: FastifyInstance) {
  // ── Dashboard stats ───────────────────────────────────────
  app.get('/api/admin/stats', { preHandler: adminGuard }, async () => {
    const [totalUsers] = db.select({ c: sql<number>`count(*)` }).from(users).all();
    const [totalPatients] = db.select({ c: sql<number>`count(*)` }).from(patients).all();
    const [totalAppointments] = db.select({ c: sql<number>`count(*)` }).from(appointments).all();
    const [totalTranscriptions] = db.select({ c: sql<number>`count(*)` }).from(sessionTranscripts).all();
    const [monthRevenue] = db.select({ c: sql<number>`coalesce(sum(value),0)` }).from(transactions)
      .where(sql`type='receita' AND status='pago' AND date >= date('now','start of month')`).all();

    // Users by plan
    const usersByPlan = db.select({
      planName: plans.name,
      count: sql<number>`count(*)`,
    }).from(userSubscriptions)
      .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
      .groupBy(plans.name).all();

    // Recent signups (last 30 days)
    const recentSignups = db.select().from(users)
      .where(sql`created_at >= datetime('now', '-30 days')`)
      .orderBy(desc(users.createdAt)).limit(10).all()
      .map(u => ({ id: u.id, name: u.name, email: u.email, category: u.category, createdAt: u.createdAt }));

    return {
      totalUsers: totalUsers.c,
      totalPatients: totalPatients.c,
      totalAppointments: totalAppointments.c,
      totalTranscriptions: totalTranscriptions.c,
      platformRevenue: monthRevenue.c,
      usersByPlan,
      recentSignups,
    };
  });

  // ── Global Config (API keys, settings) ────────────────────
  app.get('/api/admin/config', { preHandler: adminGuard }, async () => {
    return db.select().from(systemConfig).all();
  });

  app.post('/api/admin/config', { preHandler: adminGuard }, async (req, reply) => {
    const parsed = z.object({
      key: z.string().min(1),
      value: z.string(),
      description: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const existing = db.select().from(systemConfig).where(eq(systemConfig.key, parsed.data.key)).get();
    if (existing) {
      db.update(systemConfig).set({ value: parsed.data.value, updatedAt: new Date().toISOString() })
        .where(eq(systemConfig.key, parsed.data.key)).run();
    } else {
      db.insert(systemConfig).values({ ...parsed.data }).run();
    }

    // Log the change
    db.insert(auditLog).values({
      userId: req.user.userId, action: 'update', entity: 'global_config',
      entityId: parsed.data.key, details: JSON.stringify({ key: parsed.data.key }),
    }).run();

    return { ok: true };
  });

  app.delete('/api/admin/config/:key', { preHandler: adminGuard }, async (req) => {
    const { key } = req.params as { key: string };
    db.delete(systemConfig).where(eq(systemConfig.key, key)).run();
    return { ok: true };
  });

  // ── Bulk config update (for the settings form) ────────────
  app.post('/api/admin/config/bulk', { preHandler: adminGuard }, async (req) => {
    const items = req.body as Array<{ key: string; value: string; description?: string }>;
    for (const item of items) {
      const existing = db.select().from(systemConfig).where(eq(systemConfig.key, item.key)).get();
      if (existing) {
        db.update(systemConfig).set({ value: item.value, updatedAt: new Date().toISOString() })
          .where(eq(systemConfig.key, item.key)).run();
      } else {
        db.insert(systemConfig).values(item).run();
      }
    }
    return { ok: true };
  });

  // ── Users management ──────────────────────────────────────
  app.get('/api/admin/users', { preHandler: adminGuard }, async (req) => {
    const { page = '1', limit = '20', search } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.select({
      id: users.id, name: users.name, email: users.email, role: users.role,
      category: users.category, phone: users.phone, createdAt: users.createdAt,
    }).from(users);

    if (search) {
      query = query.where(sql`name LIKE ${'%' + search + '%'} OR email LIKE ${'%' + search + '%'}`) as any;
    }

    const items = (query as any).orderBy(desc(users.createdAt)).limit(parseInt(limit)).offset(offset).all();
    const [{ total }] = db.select({ total: sql<number>`count(*)` }).from(users).all();

    // Enrich with subscription info
    const enriched = items.map((u: any) => {
      const sub = db.select().from(userSubscriptions)
        .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
        .where(eq(userSubscriptions.userId, u.id)).get();
      const patientCount = db.select({ c: sql<number>`count(*)` }).from(patients).where(eq(patients.ownerId, u.id)).all()[0]?.c || 0;
      return {
        ...u,
        plan: (sub as any)?.plans?.name || 'Sem plano',
        planStatus: (sub as any)?.user_subscriptions?.status || 'none',
        patientCount,
      };
    });

    return { data: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total } };
  });

  app.patch('/api/admin/users/:id', { preHandler: adminGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({
      role: z.enum(['user', 'admin']).optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    db.update(users).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(users.id, id)).run();
    return { ok: true };
  });

  app.delete('/api/admin/users/:id', { preHandler: adminGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user.userId) return reply.status(400).send({ error: 'Não pode excluir a si mesmo' });
    db.delete(users).where(eq(users.id, id)).run();
    return { ok: true };
  });

  // ── Plans CRUD ────────────────────────────────────────────
  app.get('/api/admin/plans', { preHandler: adminGuard }, async () => {
    return db.select().from(plans).all();
  });

  app.post('/api/admin/plans', { preHandler: adminGuard }, async (req, reply) => {
    const parsed = z.object({
      name: z.string().min(1), slug: z.string().min(1), maxPatients: z.number().default(50),
      maxAppointmentsMonth: z.number().default(100), hasAI: z.boolean().default(false),
      hasTelehealth: z.boolean().default(false), hasWhatsapp: z.boolean().default(false),
      hasTranscription: z.boolean().default(false), price: z.number().default(0),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const [plan] = db.insert(plans).values(parsed.data).returning().all();
    return reply.status(201).send(plan);
  });

  app.patch('/api/admin/plans/:id', { preHandler: adminGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    db.update(plans).set(data).where(eq(plans.id, id)).run();
    return { ok: true };
  });

  app.delete('/api/admin/plans/:id', { preHandler: adminGuard }, async (req) => {
    const { id } = req.params as { id: string };
    db.delete(plans).where(eq(plans.id, id)).run();
    return { ok: true };
  });

  // ── Assign plan to user ───────────────────────────────────
  app.post('/api/admin/users/:userId/plan', { preHandler: adminGuard }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = z.object({ planId: z.string().min(1), status: z.enum(['active', 'trial', 'expired', 'cancelled']).default('active') }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const existing = db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).get();
    if (existing) {
      db.update(userSubscriptions).set({ planId: parsed.data.planId, status: parsed.data.status }).where(eq(userSubscriptions.userId, userId)).run();
    } else {
      db.insert(userSubscriptions).values({ userId, planId: parsed.data.planId, status: parsed.data.status }).run();
    }
    return { ok: true };
  });

  // ── Audit log ─────────────────────────────────────────────
  app.get('/api/admin/audit', { preHandler: adminGuard }, async (req) => {
    const { limit = '50' } = req.query as any;
    return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(parseInt(limit)).all();
  });

  // ── Seed initial admin + plans ────────────────────────────
  app.post('/api/admin/seed', async (req, reply) => {
    // Only works if no admin exists
    const admin = db.select().from(users).where(eq(users.role, 'admin')).get();
    if (admin) return reply.status(400).send({ error: 'Admin já existe' });

    const parsed = z.object({ name: z.string(), email: z.string().email(), password: z.string().min(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const pwHash = await hashPassword(parsed.data.password);
    const [newAdmin] = db.insert(users).values({
      name: parsed.data.name, email: parsed.data.email, passwordHash: pwHash, role: 'admin',
    }).returning().all();

    // Seed default plans
    const defaultPlans = [
      { name: 'Gratuito', slug: 'free', maxPatients: 10, maxAppointmentsMonth: 20, price: 0, hasAI: false, hasTelehealth: true, hasWhatsapp: false, hasTranscription: false },
      { name: 'Profissional', slug: 'pro', maxPatients: 200, maxAppointmentsMonth: 500, price: 97, hasAI: true, hasTelehealth: true, hasWhatsapp: true, hasTranscription: false },
      { name: 'Premium', slug: 'premium', maxPatients: 9999, maxAppointmentsMonth: 9999, price: 197, hasAI: true, hasTelehealth: true, hasWhatsapp: true, hasTranscription: true },
    ];
    for (const p of defaultPlans) {
      db.insert(plans).values(p).run();
    }

    // Seed default API config keys
    const defaultConfig = [
      { key: 'ai_api_url', value: 'https://api.laozhang.ai/v1/chat/completions', description: 'URL da API de IA (Laozhang / OpenAI compatible)' },
      { key: 'ai_api_key', value: '', description: 'Chave da API de IA' },
      { key: 'ai_model', value: 'deepseek-v3', description: 'Modelo de IA (deepseek-v3, gpt-4o, etc)' },
      { key: 'downsub_api_url', value: 'https://api.downsub.com/v1', description: 'URL da API Downsub (transcrição)' },
      { key: 'downsub_api_key', value: '', description: 'Chave da API Downsub' },
      { key: 'jitsi_domain', value: 'meet.jit.si', description: 'Domínio Jitsi Meet para teleconsulta' },
      { key: 'platform_name', value: 'Espaço Terapêutico', description: 'Nome da plataforma' },
      { key: 'support_email', value: 'contato@espacoterapeutico.com', description: 'Email de suporte' },
      { key: 'trial_days', value: '14', description: 'Dias de trial para novos usuários' },
    ];
    for (const c of defaultConfig) {
      db.insert(systemConfig).values(c).run();
    }

    return reply.status(201).send({ admin: { id: newAdmin.id, name: newAdmin.name, email: newAdmin.email }, plansCreated: 3, configKeysCreated: defaultConfig.length });
  });
}
