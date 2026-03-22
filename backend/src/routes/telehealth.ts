import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { appointments, patients, notifications } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import crypto from 'crypto';

// In-memory waiting rooms (no persistence needed - ephemeral)
const waitingRooms = new Map<string, {
  sessionId: string;
  hostId: string;
  hostName: string;
  patients: Array<{ id: string; name: string; joinedAt: string; admitted: boolean }>;
  status: 'waiting' | 'in_session' | 'ended';
  appointmentId?: string;
  createdAt: string;
}>();

export async function telehealthRoutes(app: FastifyInstance) {
  // ── Create session (therapist) ────────────────────────────
  app.post('/api/telehealth/sessions', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      appointmentId: z.string().optional(),
      patientName: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const sessionId = crypto.randomBytes(4).toString('hex'); // short, shareable
    const room = {
      sessionId,
      hostId: req.user.userId,
      hostName: '', // will be filled
      patients: [],
      status: 'waiting' as const,
      appointmentId: parsed.data?.appointmentId,
      createdAt: new Date().toISOString(),
    };

    waitingRooms.set(sessionId, room);

    // Generate JWT-like token for patient access (no auth needed)
    const patientToken = crypto.randomBytes(16).toString('hex');

    return reply.status(201).send({
      sessionId,
      hostUrl: `/teleconsulta/sala/${sessionId}`,
      patientUrl: `/teleconsulta/entrar/${sessionId}?token=${patientToken}`,
      patientToken,
      jitsiRoom: `espaco-${sessionId}`,
    });
  });

  // ── Get session info ──────────────────────────────────────
  app.get('/api/telehealth/sessions/:sessionId', async (req) => {
    const { sessionId } = req.params as { sessionId: string };
    const room = waitingRooms.get(sessionId);
    if (!room) return { error: 'Sessão não encontrada', exists: false };
    return {
      exists: true,
      sessionId: room.sessionId,
      status: room.status,
      patientsWaiting: room.patients.filter(p => !p.admitted).length,
      patients: room.patients,
      createdAt: room.createdAt,
    };
  });

  // ── Patient joins waiting room (no auth required) ─────────
  app.post('/api/telehealth/sessions/:sessionId/join', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Nome obrigatório' });

    const room = waitingRooms.get(sessionId);
    if (!room) return reply.status(404).send({ error: 'Sessão não encontrada' });
    if (room.status === 'ended') return reply.status(400).send({ error: 'Sessão encerrada' });

    const patientEntry = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      joinedAt: new Date().toISOString(),
      admitted: false,
    };
    room.patients.push(patientEntry);

    // Notify therapist
    db.insert(notifications).values({
      userId: room.hostId,
      title: 'Paciente na sala de espera',
      body: `${parsed.data.name} está aguardando na teleconsulta`,
      type: 'system',
      data: JSON.stringify({ sessionId, patientId: patientEntry.id }),
    }).run();

    return { patientId: patientEntry.id, position: room.patients.filter(p => !p.admitted).length };
  });

  // ── Admit patient (therapist) ─────────────────────────────
  app.post('/api/telehealth/sessions/:sessionId/admit/:patientId', { preHandler: authGuard }, async (req, reply) => {
    const { sessionId, patientId } = req.params as { sessionId: string; patientId: string };
    const room = waitingRooms.get(sessionId);
    if (!room) return reply.status(404).send({ error: 'Sessão não encontrada' });
    if (room.hostId !== req.user.userId) return reply.status(403).send({ error: 'Sem permissão' });

    const patient = room.patients.find(p => p.id === patientId);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    patient.admitted = true;
    room.status = 'in_session';

    return { ok: true, jitsiRoom: `espaco-${sessionId}` };
  });

  // ── Check admission status (patient polls this) ───────────
  app.get('/api/telehealth/sessions/:sessionId/status/:patientId', async (req) => {
    const { sessionId, patientId } = req.params as { sessionId: string; patientId: string };
    const room = waitingRooms.get(sessionId);
    if (!room) return { admitted: false, ended: true };
    const patient = room.patients.find(p => p.id === patientId);
    return {
      admitted: patient?.admitted || false,
      ended: room.status === 'ended',
      position: room.patients.filter(p => !p.admitted).indexOf(patient!) + 1,
      jitsiRoom: patient?.admitted ? `espaco-${sessionId}` : null,
    };
  });

  // ── End session ───────────────────────────────────────────
  app.post('/api/telehealth/sessions/:sessionId/end', { preHandler: authGuard }, async (req) => {
    const { sessionId } = req.params as { sessionId: string };
    const room = waitingRooms.get(sessionId);
    if (room) {
      room.status = 'ended';
      // Clean up after 5 minutes
      setTimeout(() => waitingRooms.delete(sessionId), 5 * 60 * 1000);
    }
    return { ok: true };
  });

  // ── List active sessions (therapist) ──────────────────────
  app.get('/api/telehealth/my-sessions', { preHandler: authGuard }, async (req) => {
    const sessions: any[] = [];
    waitingRooms.forEach((room) => {
      if (room.hostId === req.user.userId && room.status !== 'ended') {
        sessions.push({
          sessionId: room.sessionId,
          status: room.status,
          patientsWaiting: room.patients.filter(p => !p.admitted).length,
          createdAt: room.createdAt,
        });
      }
    });
    return sessions;
  });
}
