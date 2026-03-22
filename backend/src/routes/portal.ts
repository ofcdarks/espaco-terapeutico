import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patients, appointments, documents } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

// Simple token-based auth for patients (no password needed)
const patientTokens = new Map<string, { patientId: string; ownerId: string; expiresAt: number }>();

export async function portalRoutes(app: FastifyInstance) {
  // Generate portal link (therapist sends to patient)
  app.post('/api/portal/generate-link', async (req, reply) => {
    const parsed = z.object({ patientId: z.string() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });
    const patient = db.select().from(patients).where(eq(patients.id, parsed.data.patientId)).get();
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });
    const token = crypto.randomBytes(24).toString('hex');
    patientTokens.set(token, { patientId: patient.id, ownerId: patient.ownerId, expiresAt: Date.now() + 30 * 86400000 });
    return { token, url: "/portal/" + token + "" };
  });

  // Patient access via token
  app.get('/api/portal/:token/info', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = patientTokens.get(token);
    if (!session || session.expiresAt < Date.now()) return reply.status(401).send({ error: 'Link expirado' });
    const patient = db.select().from(patients).where(eq(patients.id, session.patientId)).get();
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });
    return { name: patient.name, email: patient.email };
  });

  // Patient sees upcoming appointments
  app.get('/api/portal/:token/appointments', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = patientTokens.get(token);
    if (!session || session.expiresAt < Date.now()) return reply.status(401).send({ error: 'Link expirado' });
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(appointments).where(
      and(eq(appointments.patientId, session.patientId), eq(appointments.ownerId, session.ownerId), gte(appointments.date, today))
    ).all();
  });

  // Patient confirms appointment
  app.post('/api/portal/:token/confirm/:appointmentId', async (req, reply) => {
    const { token, appointmentId } = req.params as { token: string; appointmentId: string };
    const session = patientTokens.get(token);
    if (!session || session.expiresAt < Date.now()) return reply.status(401).send({ error: 'Link expirado' });
    db.update(appointments).set({ status: 'confirmado' })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.patientId, session.patientId))).run();
    return { ok: true };
  });

  // Patient sees their documents
  app.get('/api/portal/:token/documents', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = patientTokens.get(token);
    if (!session || session.expiresAt < Date.now()) return reply.status(401).send({ error: 'Link expirado' });
    return db.select().from(documents).where(
      and(eq(documents.patientId, session.patientId), eq(documents.ownerId, session.ownerId))
    ).all();
  });
}
