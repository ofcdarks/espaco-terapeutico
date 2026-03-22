import cron from 'node-cron';
import { db } from '../db/index.js';
import { appointments, pushSubscriptions, users } from '../db/schema.js';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import { cleanExpiredTokens } from '../lib/auth.js';
import { sqlite } from '../db/index.js';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { FastifyInstance } from 'fastify';

// ============================================================
// Push notification helper (web-push)
// ============================================================
async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  try {
    const webpush = await import('web-push');

    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:contato@espacoterapeutico.com';

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.warn('[Cron] VAPID keys not configured, skipping push');
      return false;
    }

    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    await webpush.default.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    console.error('[Cron] Push notification error:', err);
    return false;
  }
}

// ============================================================
// Appointment reminder processor
// ============================================================
async function processReminders(hoursAhead: number, reminderField: 'reminderSent1h' | 'reminderSent24h') {
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Window: target ± 10 minutes
  const windowStart = new Date(targetTime.getTime() - 10 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 10 * 60 * 1000);

  const startDate = windowStart.toISOString().split('T')[0];
  const endDate = windowEnd.toISOString().split('T')[0];
  const startTime = windowStart.toTimeString().slice(0, 5);
  const endTime = windowEnd.toTimeString().slice(0, 5);

  // Find appointments that need reminders
  const pending = db
    .select()
    .from(appointments)
    .where(
      and(
        or(eq(appointments.status, 'agendado'), eq(appointments.status, 'confirmado')),
        eq(appointments[reminderField], false),
        gte(appointments.date, startDate),
        lte(appointments.date, endDate)
      )
    )
    .all();

  // Filter by time window
  const filtered = pending.filter((apt) => {
    if (apt.date === startDate && apt.date === endDate) {
      return apt.time >= startTime && apt.time <= endTime;
    }
    if (apt.date === startDate) return apt.time >= startTime;
    if (apt.date === endDate) return apt.time <= endTime;
    return true;
  });

  let sent = 0;
  for (const apt of filtered) {
    // Get push subscriptions for the owner (therapist)
    const subs = db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, apt.ownerId))
      .all();

    const timeLabel = hoursAhead === 1 ? 'em 1 hora' : 'em 24 horas';
    const payload = {
      title: 'Lembrete de Consulta',
      body: `${apt.patientName} - ${apt.date} às ${apt.time} (${timeLabel})`,
      data: { appointmentId: apt.id, url: '/agenda' },
    };

    for (const sub of subs) {
      await sendPush(sub, payload);
    }

    // Mark as sent
    const sentAtField = reminderField === 'reminderSent1h' ? 'reminderSent1hAt' : 'reminderSent24hAt';
    db.update(appointments)
      .set({
        [reminderField]: true,
        [sentAtField]: new Date().toISOString(),
      })
      .where(eq(appointments.id, apt.id))
      .run();

    sent++;
  }

  return sent;
}

// ============================================================
// Database backup
// ============================================================
function backupDatabase() {
  const DB_PATH = process.env.DATABASE_URL || './data/espaco.db';
  const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups';

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${BACKUP_DIR}/espaco-${timestamp}.db`;

  // Use SQLite backup API (safe for WAL mode)
  sqlite.backup(backupPath)
    .then(() => {
      console.log(`[Backup] Database backed up to ${backupPath}`);

      // Keep only last 7 backups
      const { readdirSync, unlinkSync } = require('fs');
      const files = readdirSync(BACKUP_DIR)
        .filter((f: string) => f.startsWith('espaco-') && f.endsWith('.db'))
        .sort()
        .reverse();

      for (const file of files.slice(7)) {
        unlinkSync(`${BACKUP_DIR}/${file}`);
        console.log(`[Backup] Removed old backup: ${file}`);
      }
    })
    .catch((err: Error) => {
      console.error('[Backup] Error:', err);
    });
}

// ============================================================
// Register all cron jobs
// ============================================================
export function registerCronJobs(app: FastifyInstance) {
  // Every 10 minutes: check appointment reminders
  cron.schedule('*/10 * * * *', async () => {
    try {
      const sent1h = await processReminders(1, 'reminderSent1h');
      const sent24h = await processReminders(24, 'reminderSent24h');
      if (sent1h > 0 || sent24h > 0) {
        app.log.info(`[Cron] Reminders sent: 1h=${sent1h}, 24h=${sent24h}`);
      }
    } catch (err) {
      app.log.error('[Cron] Reminder error:', err);
    }
  });

  // Every day at 3 AM: clean expired refresh tokens
  cron.schedule('0 3 * * *', () => {
    try {
      cleanExpiredTokens();
      app.log.info('[Cron] Expired tokens cleaned');
    } catch (err) {
      app.log.error('[Cron] Token cleanup error:', err);
    }
  });

  // Every day at 2 AM: backup database
  cron.schedule('0 2 * * *', () => {
    try {
      backupDatabase();
    } catch (err) {
      app.log.error('[Cron] Backup error:', err);
    }
  });

  app.log.info('[Cron] All jobs registered');
}
