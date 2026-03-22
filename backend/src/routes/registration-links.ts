import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patients } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import crypto from 'crypto';

// In-memory store for registration links
const regLinks = new Map<string, { id: string; ownerId: string; createdAt: string; expiresAt: string; usedAt?: string; patientId?: string }>();

export async function registrationLinkRoutes(app: FastifyInstance) {
  // Create link
  app.post('/api/registration-links', { preHandler: authGuard }, async (req) => {
    const id = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
    const link = { id, ownerId: req.user.userId, createdAt: now.toISOString(), expiresAt: expires.toISOString() };
    regLinks.set(id, link);
    return { ...link, url: `${process.env.CORS_ORIGIN || ''}/cadastro/${id}` };
  });

  // List links
  app.get('/api/registration-links', { preHandler: authGuard }, async (req) => {
    const links: any[] = [];
    regLinks.forEach(l => { if (l.ownerId === req.user.userId) links.push({ ...l, url: `${process.env.CORS_ORIGIN || ''}/cadastro/${l.id}` }); });
    return links.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  // Public: get link info
  app.get('/api/registration-links/:id/info', async (req, reply) => {
    const link = regLinks.get((req.params as any).id);
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.usedAt) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expiresAt) < new Date()) return reply.status(410).send({ error: 'Link expirado' });
    return { valid: true, expiresAt: link.expiresAt };
  });

  // Public: patient registers via link
  app.post('/api/registration-links/:id/register', async (req, reply) => {
    const link = regLinks.get((req.params as any).id);
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.usedAt) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expiresAt) < new Date()) return reply.status(410).send({ error: 'Link expirado' });

    const parsed = z.object({ name: z.string().min(2), email: z.string().email().optional(), phone: z.string().optional(), cpf: z.string().optional(), birthDate: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const [patient] = db.insert(patients).values({ ...parsed.data, ownerId: link.ownerId, email: parsed.data.email || '', phone: parsed.data.phone || '' }).returning().all();
    link.usedAt = new Date().toISOString();
    link.patientId = patient.id;
    return reply.status(201).send({ ok: true, patientName: patient.name });
  });

  // Delete link
  app.delete('/api/registration-links/:id', { preHandler: authGuard }, async (req) => {
    regLinks.delete((req.params as any).id);
    return { ok: true };
  });
}
