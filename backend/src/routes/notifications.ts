import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications', { preHandler: authGuard }, async (req) => {
    const { limit = '20', unreadOnly } = req.query as any;
    let conditions = [eq(notifications.userId, req.user.userId)];
    if (unreadOnly === 'true') conditions.push(isNull(notifications.readAt));
    return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(parseInt(limit)).all();
  });

  app.get('/api/notifications/unread-count', { preHandler: authGuard }, async (req) => {
    const [{ count }] = db.select({ count: sql<number>`count(*)` }).from(notifications)
      .where(and(eq(notifications.userId, req.user.userId), isNull(notifications.readAt))).all();
    return { count };
  });

  app.patch('/api/notifications/:id/read', { preHandler: authGuard }, async (req) => {
    const { id } = req.params as { id: string };
    db.update(notifications).set({ readAt: new Date().toISOString() }).where(and(eq(notifications.id, id), eq(notifications.userId, req.user.userId))).run();
    return { ok: true };
  });

  app.post('/api/notifications/read-all', { preHandler: authGuard }, async (req) => {
    db.update(notifications).set({ readAt: new Date().toISOString() }).where(and(eq(notifications.userId, req.user.userId), isNull(notifications.readAt))).run();
    return { ok: true };
  });
}
