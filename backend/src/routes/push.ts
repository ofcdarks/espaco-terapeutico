import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function pushRoutes(app: FastifyInstance) {
  // Get VAPID public key (client needs this to subscribe)
  app.get('/api/push/vapid-key', async () => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
  });

  // Subscribe to push notifications
  app.post('/api/push/subscribe', { preHandler: authGuard }, async (request, reply) => {
    const parsed = subscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { endpoint, keys } = parsed.data;

    // Upsert: remove old subscription for this endpoint, add new
    db.delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, request.user.userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      )
      .run();

    db.insert(pushSubscriptions)
      .values({
        userId: request.user.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      .run();

    return reply.status(201).send({ ok: true });
  });

  // Unsubscribe
  app.post('/api/push/unsubscribe', { preHandler: authGuard }, async (request, reply) => {
    const { endpoint } = request.body as { endpoint: string };

    db.delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, request.user.userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      )
      .run();

    return { ok: true };
  });
}
