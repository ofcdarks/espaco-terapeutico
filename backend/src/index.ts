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
import { portalRoutes } from './routes/portal.js';
import { csvRoutes } from './routes/csv.js';
import { contractRoutes } from './routes/contracts.js';
import { stripeRoutes } from './routes/stripe.js';
import { twofaRoutes } from './routes/twofa.js';
import { portalRoutes } from './routes/portal.js';
import { csvRoutes } from './routes/csv.js';
import { contractRoutes } from './routes/contracts.js';
import { adminRoutes } from './routes/admin.js';
import { transcriptionRoutes } from './routes/transcription.js';
import { stripeRoutes } from './routes/stripe.js';
import { portalRoutes } from './routes/portal.js';
import { csvRoutes } from './routes/csv.js';
import { contractRoutes } from './routes/contracts.js';
import { stripeRoutes } from './routes/stripe.js';
import { twofaRoutes } from './routes/twofa.js';
import { portalRoutes } from './routes/portal.js';
import { csvRoutes } from './routes/csv.js';
import { contractRoutes } from './routes/contracts.js';
import { registerCronJobs } from './cron/index.js';
import './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── P0 FIX: Validate required env vars at startup ──────────
function validateEnv() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET must be set and at least 32 characters.');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    console.warn('WARNING: CORS_ORIGIN not set. Defaulting to restrictive policy.');
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

// ── Plugins ─────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:8080'],
  credentials: true,
});
await app.register(helmet, { contentSecurityPolicy: false });

// Global rate limit
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// ── P2 FIX: Stricter rate limit on auth endpoints ───────────
await app.register(async function authLimiter(instance) {
  await instance.register(rateLimit, {
    max: 10,
    timeWindow: '5 minutes',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Muitas tentativas. Aguarde 5 minutos.',
    }),
  });
  // Auth routes registered inside this scope get the stricter limit
  await instance.register(authRoutes);
});

// ── API Routes ──────────────────────────────────────────────
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
await app.register(portalRoutes);
await app.register(csvRoutes);
await app.register(contractRoutes);
await app.register(stripeRoutes);
await app.register(twofaRoutes);
await app.register(portalRoutes);
await app.register(csvRoutes);
await app.register(contractRoutes);
await app.register(adminRoutes);
await app.register(transcriptionRoutes);
await app.register(stripeRoutes);
await app.register(portalRoutes);
await app.register(csvRoutes);
await app.register(contractRoutes);
await app.register(stripeRoutes);
await app.register(twofaRoutes);
await app.register(portalRoutes);
await app.register(csvRoutes);
await app.register(contractRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

// ── Static files ────────────────────────────────────────────
const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, '..', 'public');
if (existsSync(STATIC_DIR)) {
  await app.register(fastifyStatic, { root: STATIC_DIR, prefix: '/', wildcard: false, decorateReply: false });
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Endpoint não encontrado' });
    return reply.sendFile('index.html', STATIC_DIR);
  });
} else {
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Endpoint não encontrado' });
    return reply.status(200).send({ message: 'API running. Frontend not built.' });
  });
}

// ── Cron ────────────────────────────────────────────────────
registerCronJobs(app);

// ── Start ───────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down...`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
