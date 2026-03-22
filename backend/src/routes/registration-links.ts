import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { registrationLinks, patients } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import crypto from 'crypto';

export async function registrationLinkRoutes(app: FastifyInstance) {
  app.post('/api/registration-links', { preHandler: authGuard }, async (req) => {
    const id = crypto.randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const origin = process.env.CORS_ORIGIN || `${req.protocol}://${req.hostname}`;
    const url = `${origin}/cadastro/${id}`;
    const [link] = db.insert(registrationLinks).values({ id, ownerId: req.user.userId, url, expiresAt: expires }).returning().all();
    return link;
  });

  app.get('/api/registration-links', { preHandler: authGuard }, async (req) => {
    return db.select().from(registrationLinks).where(eq(registrationLinks.ownerId, req.user.userId)).orderBy(desc(registrationLinks.createdAt)).all();
  });

  app.get('/api/registration-links/:id/info', async (req, reply) => {
    const link = db.select().from(registrationLinks).where(eq(registrationLinks.id, (req.params as any).id)).get();
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.usedAt) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expiresAt) < new Date()) return reply.status(410).send({ error: 'Link expirado' });
    return { valid: true, expiresAt: link.expiresAt };
  });

  app.post('/api/registration-links/:id/register', async (req, reply) => {
    const link = db.select().from(registrationLinks).where(eq(registrationLinks.id, (req.params as any).id)).get();
    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.usedAt) return reply.status(410).send({ error: 'Link já utilizado' });
    if (new Date(link.expiresAt) < new Date()) return reply.status(410).send({ error: 'Link expirado' });
    const parsed = z.object({ name: z.string().min(2), email: z.string().optional(), phone: z.string().optional(), cpf: z.string().optional(), birthDate: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const [patient] = db.insert(patients).values({ ...parsed.data, ownerId: link.ownerId, email: parsed.data.email || '', phone: parsed.data.phone || '' }).returning().all();
    db.update(registrationLinks).set({ usedAt: new Date().toISOString(), patientId: patient.id }).where(eq(registrationLinks.id, link.id)).run();
    return reply.status(201).send({ ok: true, patientName: patient.name });
  });

  app.delete('/api/registration-links/:id', { preHandler: authGuard }, async (req) => {
    db.delete(registrationLinks).where(and(eq(registrationLinks.id, (req.params as any).id), eq(registrationLinks.ownerId, req.user.userId))).run();
    return { ok: true };
  });
}
