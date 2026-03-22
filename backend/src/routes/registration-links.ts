import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { registrationLinks, patients } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import crypto from 'crypto';

export async function registrationLinkRoutes(app: FastifyInstance) {
  // Ensure table exists on startup
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS registration_links (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      url TEXT DEFAULT '',
      used_at TEXT,
      patient_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  } catch (e) { console.warn('registration_links table:', e); }

  app.post('/api/registration-links', { preHandler: authGuard }, async (req, reply) => {
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      // Use raw SQL for reliability
      db.exec(`INSERT INTO registration_links (id, owner_id, url, expires_at, created_at) VALUES ('${id}', '${req.user.userId}', '', '${expires}', '${now}')`);

      return { id, ownerId: req.user.userId, expiresAt: expires, createdAt: now, usedAt: null, patientId: null };
    } catch (err: any) {
      app.log.error('Create registration link error:', err);
      return reply.status(500).send({ error: err.message || 'Erro interno' });
    }
  });

  app.get('/api/registration-links', { preHandler: authGuard }, async (req) => {
    try {
      const rows = db.prepare(`SELECT * FROM registration_links WHERE owner_id = ? ORDER BY created_at DESC`).all(req.user.userId);
      return rows;
    } catch (err: any) {
      return [];
    }
  });

  app.get('/api/registration-links/:id/info', async (req, reply) => {
    const { id } = req.params as { id: string };
    const link = db.prepare(`SELECT * FROM registration_links WHERE id = ?`).get(id) as any;
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.used_at) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expires_at) < new Date()) return reply.status(410).send({ error: 'Link expirado' });
    return { valid: true, expiresAt: link.expires_at };
  });

  app.post('/api/registration-links/:id/register', async (req, reply) => {
    const { id } = req.params as { id: string };
    const link = db.prepare(`SELECT * FROM registration_links WHERE id = ?`).get(id) as any;
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.used_at) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expires_at) < new Date()) return reply.status(410).send({ error: 'Link expirado' });

    const parsed = z.object({ name: z.string().min(2), email: z.string().optional(), phone: z.string().optional(), cpf: z.string().optional(), birthDate: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const [patient] = db.insert(patients).values({ ...parsed.data, ownerId: link.owner_id, email: parsed.data.email || '', phone: parsed.data.phone || '' }).returning().all();
    db.exec(`UPDATE registration_links SET used_at = '${new Date().toISOString()}', patient_id = '${patient.id}' WHERE id = '${id}'`);
    return reply.status(201).send({ ok: true, patientName: patient.name });
  });

  app.delete('/api/registration-links/:id', { preHandler: authGuard }, async (req) => {
    const { id } = req.params as { id: string };
    db.exec(`DELETE FROM registration_links WHERE id = '${id}' AND owner_id = '${req.user.userId}'`);
    return { ok: true };
  });
}
