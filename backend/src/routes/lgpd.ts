import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patientConsents, patients, appointments, records, transactions, documents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function lgpdRoutes(app: FastifyInstance) {
  // Record consent
  app.post('/api/lgpd/consent', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      patientId: z.string().min(1),
      type: z.enum(['tratamento', 'dados_pessoais', 'teleconsulta', 'compartilhamento']),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const [consent] = db.insert(patientConsents).values({
      ownerId: req.user.userId, patientId: parsed.data.patientId, type: parsed.data.type,
      consentedAt: new Date().toISOString(), ipAddress: req.ip,
    }).returning().all();
    return reply.status(201).send(consent);
  });

  // Get consents for patient
  app.get('/api/lgpd/consent/:patientId', { preHandler: authGuard }, async (req) => {
    const { patientId } = req.params as { patientId: string };
    return db.select().from(patientConsents).where(and(eq(patientConsents.ownerId, req.user.userId), eq(patientConsents.patientId, patientId))).all();
  });

  // Revoke consent
  app.patch('/api/lgpd/consent/:id/revoke', { preHandler: authGuard }, async (req) => {
    const { id } = req.params as { id: string };
    db.update(patientConsents).set({ revokedAt: new Date().toISOString() }).where(eq(patientConsents.id, id)).run();
    return { ok: true };
  });

  // Export all patient data (LGPD portability)
  app.get('/api/lgpd/export/:patientId', { preHandler: authGuard }, async (req) => {
    const { patientId } = req.params as { patientId: string };
    const ownerId = req.user.userId;
    const patient = db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.ownerId, ownerId))).get();
    if (!patient) return { error: 'Paciente não encontrado' };
    const appts = db.select().from(appointments).where(and(eq(appointments.patientId, patientId), eq(appointments.ownerId, ownerId))).all();
    const recs = db.select().from(records).where(and(eq(records.patientId, patientId), eq(records.ownerId, ownerId))).all();
    const txs = db.select().from(transactions).where(and(eq(transactions.patientId, patientId), eq(transactions.ownerId, ownerId))).all();
    const docs = db.select().from(documents).where(and(eq(documents.patientId, patientId), eq(documents.ownerId, ownerId))).all();
    const consents = db.select().from(patientConsents).where(and(eq(patientConsents.patientId, patientId), eq(patientConsents.ownerId, ownerId))).all();
    return { patient, appointments: appts, records: recs, transactions: txs, documents: docs, consents, exportedAt: new Date().toISOString() };
  });

  // Delete all patient data (LGPD right to be forgotten)
  app.delete('/api/lgpd/patient/:patientId', { preHandler: authGuard }, async (req, reply) => {
    const { patientId } = req.params as { patientId: string };
    const ownerId = req.user.userId;
    const patient = db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.ownerId, ownerId))).get();
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });
    // Cascade deletes handle most, but be explicit
    db.delete(documents).where(and(eq(documents.patientId, patientId), eq(documents.ownerId, ownerId))).run();
    db.delete(records).where(and(eq(records.patientId, patientId), eq(records.ownerId, ownerId))).run();
    db.delete(transactions).where(and(eq(transactions.patientId, patientId), eq(transactions.ownerId, ownerId))).run();
    db.delete(appointments).where(and(eq(appointments.patientId, patientId), eq(appointments.ownerId, ownerId))).run();
    db.delete(patientConsents).where(and(eq(patientConsents.patientId, patientId), eq(patientConsents.ownerId, ownerId))).run();
    db.delete(patients).where(and(eq(patients.id, patientId), eq(patients.ownerId, ownerId))).run();
    return { ok: true, message: 'Todos os dados do paciente foram removidos.' };
  });
}
