import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { whatsappConfig, appointments, patients } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function whatsappRoutes(app: FastifyInstance) {
  // Save WhatsApp config
  app.post('/api/whatsapp/config', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      apiUrl: z.string().url(), apiKey: z.string().min(1),
      instanceName: z.string().default('default'), enabled: z.boolean().default(true),
      reminderTemplate: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const existing = db.select().from(whatsappConfig).where(eq(whatsappConfig.userId, req.user.userId)).get();
    if (existing) {
      db.update(whatsappConfig).set(parsed.data).where(eq(whatsappConfig.userId, req.user.userId)).run();
    } else {
      db.insert(whatsappConfig).values({ ...parsed.data, userId: req.user.userId }).run();
    }
    return { ok: true };
  });

  app.get('/api/whatsapp/config', { preHandler: authGuard }, async (req) => {
    return db.select().from(whatsappConfig).where(eq(whatsappConfig.userId, req.user.userId)).get() || null;
  });

  // Send message via Evolution API
  app.post('/api/whatsapp/send', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ phone: z.string().min(10), message: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const config = db.select().from(whatsappConfig).where(eq(whatsappConfig.userId, req.user.userId)).get();
    if (!config?.enabled) return reply.status(400).send({ error: 'WhatsApp não configurado' });
    try {
      const phone = parsed.data.phone.replace(/\D/g, '');
      const res = await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
        body: JSON.stringify({ number: `55${phone}@s.whatsapp.net`, text: parsed.data.message }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return { ok: true };
    } catch (err: any) {
      return reply.status(500).send({ error: `Erro ao enviar: ${err.message}` });
    }
  });

  // Send reminder to appointment patient
  app.post('/api/whatsapp/send-reminder/:appointmentId', { preHandler: authGuard }, async (req, reply) => {
    const { appointmentId } = req.params as { appointmentId: string };
    const apt = db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.ownerId, req.user.userId))).get();
    if (!apt) return reply.status(404).send({ error: 'Consulta não encontrada' });
    const patient = db.select().from(patients).where(eq(patients.id, apt.patientId)).get();
    if (!patient?.phone) return reply.status(400).send({ error: 'Paciente sem telefone' });
    const config = db.select().from(whatsappConfig).where(eq(whatsappConfig.userId, req.user.userId)).get();
    if (!config?.enabled) return reply.status(400).send({ error: 'WhatsApp não configurado' });
    const template = config.reminderTemplate || 'Olá {paciente}! Sua consulta está marcada para {data} às {hora}.';
    const message = template
      .replace(/{paciente}/g, patient.name.split(' ')[0])
      .replace(/{data}/g, apt.date.split('-').reverse().join('/'))
      .replace(/{hora}/g, apt.time);
    try {
      const phone = patient.phone.replace(/\D/g, '');
      await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
        body: JSON.stringify({ number: `55${phone}@s.whatsapp.net`, text: message }),
      });
      return { ok: true, message };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
