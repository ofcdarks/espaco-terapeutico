import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, TokenPayload } from '../lib/auth.js';

// Extend Fastify request to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload;
  }
}

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Token não fornecido' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.status(401).send({ error: 'Token inválido ou expirado' });
  }
}
