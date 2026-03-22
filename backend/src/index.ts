import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { appointmentRoutes } from './routes/appointments.js';
import { recordRoutes } from './routes/records.js';
import { transactionRoutes } from './routes/transactions.js';
import { packageRoutes } from './routes/packages.js';
import { documentRoutes } from './routes/documents.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { aiRoutes } from './routes/ai.js';
import { groupRoutes } from './routes/groups.js';
import { pushRoutes } from './routes/push.js';
import { whatsappRoutes } from './routes/whatsapp.js';
import { notificationRoutes } from './routes/notifications.js';
import { lgpdRoutes } from './routes/lgpd.js';
import { pdfRoutes } from './routes/pdf.js';
import { telehealthRoutes } from './routes/telehealth.js';
import { adminRoutes } from './routes/admin.js';
import { transcriptionRoutes } from './routes/transcription.js';
import { stripeRoutes } from './routes/stripe.js';
import { twofaRoutes } from './routes/twofa.js';
import { portalRoutes } from './routes/portal.js';
import { csvRoutes } from './routes/csv.js';
import { contractRoutes } from './routes/contracts.js';
import { signalingRoutes } from './routes/signaling.js';
import { registerCronJobs } from './cron/index.js';
import './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function validateEnv() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET must be set and at least 32 characters.');
    process.exit(1);
  }
}
validateEnv();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
});
await app.register(helmet, {
  contentSecurityPolicy: false,
  // Allow camera/microphone for teleconsulta
  permissionsPolicy: false,
});
// Manually set permissions for camera/mic
app.addHook("onSend", async (_req, reply) => {
  reply.header("Permissions-Policy", "camera=(self), microphone=(self), fullscreen=(self), display-capture=(self)");
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Auth with stricter rate limit
await app.register(async function authLimiter(instance) {
  await instance.register(rateLimit, {
    max: 20, timeWindow: '5 minutes',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'Muitas tentativas. Aguarde 5 minutos.' }),
  });
  await instance.register(authRoutes);
});

// All other routes
await app.register(patientRoutes);
await app.register(appointmentRoutes);
await app.register(recordRoutes);
await app.register(transactionRoutes);
await app.register(packageRoutes);
await app.register(documentRoutes);
await app.register(dashboardRoutes);
await app.register(aiRoutes);
await app.register(groupRoutes);
await app.register(pushRoutes);
await app.register(whatsappRoutes);
await app.register(notificationRoutes);
await app.register(lgpdRoutes);
await app.register(pdfRoutes);
await app.register(telehealthRoutes);
await app.register(adminRoutes);
await app.register(transcriptionRoutes);
await app.register(stripeRoutes);
await app.register(twofaRoutes);
await app.register(portalRoutes);
await app.register(csvRoutes);
await app.register(contractRoutes);
await app.register(signalingRoutes);

app.get('/api/health', async () => ({
  status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(),
}));

const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, '..', 'public');
if (existsSync(STATIC_DIR)) {
  await app.register(fastifyStatic, { root: STATIC_DIR, prefix: '/', wildcard: false, decorateReply: true });
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Endpoint não encontrado' });
    return reply.sendFile('index.html', STATIC_DIR);
  });
}

registerCronJobs(app);

const PORT = parseInt(process.env.PORT || '3000');
try { await app.listen({ port: PORT, host: '0.0.0.0' }); }
catch (err) { app.log.fatal(err); process.exit(1); }

process.on('SIGINT', async () => { await app.close(); process.exit(0); });
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
