import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authGuard } from './auth.js';

export async function adminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authGuard(request, reply);
  if (reply.sent) return;

  const user = db.select().from(users).where(eq(users.id, request.user.userId)).get();
  if (!user || !user.isAdmin) {
    reply.status(403).send({ error: 'Acesso restrito a administradores' });
  }
}
