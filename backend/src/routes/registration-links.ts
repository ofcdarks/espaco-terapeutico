import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sqlite } from '../db/index.js';
import { db } from '../db/index.js';
import { patients } from '../db/schema.js';
import { authGuard } from '../middleware/auth.js';
import crypto from 'crypto';

export async function registrationLinkRoutes(app: FastifyInstance) {
  // Ensure table exists
  sqlite.exec(`CREATE TABLE IF NOT EXISTS registration_links (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    url TEXT DEFAULT '',
    used_at TEXT,
    patient_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  app.post('/api/registration-links', { preHandler: authGuard }, async (req, reply) => {
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO registration_links (id, owner_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(id, req.user.userId, expires, now);
      return { id, ownerId: req.user.userId, expiresAt: expires, createdAt: now, usedAt: null, patientId: null };
    } catch (err: any) {
      app.log.error('Create link error:', err);
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/api/registration-links', { preHandler: authGuard }, async (req) => {
    return sqlite.prepare(`SELECT id, owner_id as ownerId, used_at as usedAt, patient_id as patientId, expires_at as expiresAt, created_at as createdAt FROM registration_links WHERE owner_id = ? ORDER BY created_at DESC`).all(req.user.userId);
  });

  app.get('/api/registration-links/:id/info', async (req, reply) => {
    const link = sqlite.prepare(`SELECT * FROM registration_links WHERE id = ?`).get((req.params as any).id) as any;
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.used_at) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expires_at) < new Date()) return reply.status(410).send({ error: 'Link expirado' });
    return { valid: true, expiresAt: link.expires_at };
  });

  app.post('/api/registration-links/:id/register', async (req, reply) => {
    const link = sqlite.prepare(`SELECT * FROM registration_links WHERE id = ?`).get((req.params as any).id) as any;
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.used_at) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expires_at) < new Date()) return reply.status(410).send({ error: 'Link expirado' });

    const parsed = z.object({ name: z.string().min(2), email: z.string().optional(), phone: z.string().optional(), cpf: z.string().optional(), birthDate: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const [patient] = db.insert(patients).values({ ...parsed.data, ownerId: link.owner_id, email: parsed.data.email || '', phone: parsed.data.phone || '' }).returning().all();
    sqlite.prepare(`UPDATE registration_links SET used_at = ?, patient_id = ? WHERE id = ?`).run(new Date().toISOString(), patient.id, link.id);
    return reply.status(201).send({ ok: true, patientName: patient.name });
  });

  app.delete('/api/registration-links/:id', { preHandler: authGuard }, async (req) => {
    sqlite.prepare(`DELETE FROM registration_links WHERE id = ? AND owner_id = ?`).run((req.params as any).id, req.user.userId);
    return { ok: true };
  });
}
