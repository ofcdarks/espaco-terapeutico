import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export async function twofaRoutes(app: FastifyInstance) {
  // Generate 2FA secret + QR code
  app.post('/api/auth/2fa/setup', { preHandler: authGuard }, async (req) => {
    const secret = speakeasy.generateSecret({ name: `EspacoTerapeutico:${req.user.email}`, issuer: 'Espaço Terapêutico' });
    db.update(users).set({ twoFactorSecret: secret.base32 }).where(eq(users.id, req.user.userId)).run();
    const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCode: qrUrl };
  });

  // Verify and enable 2FA
  app.post('/api/auth/2fa/verify', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ token: z.string().length(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Token de 6 dígitos obrigatório' });
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    if (!user?.twoFactorSecret) return reply.status(400).send({ error: '2FA não configurado' });
    const valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: parsed.data.token, window: 1 });
    if (!valid) return reply.status(400).send({ error: 'Token inválido' });
    db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, req.user.userId)).run();
    return { ok: true };
  });

  // Disable 2FA
  app.post('/api/auth/2fa/disable', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ token: z.string().length(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Token obrigatório' });
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    if (!user?.twoFactorSecret) return reply.status(400).send({ error: '2FA não ativo' });
    const valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: parsed.data.token, window: 1 });
    if (!valid) return reply.status(400).send({ error: 'Token inválido' });
    db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, req.user.userId)).run();
    return { ok: true };
  });

  // Validate 2FA during login (called after password check)
  app.post('/api/auth/2fa/validate', async (req, reply) => {
    const parsed = z.object({ userId: z.string(), token: z.string().length(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });
    const user = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
    if (!user?.twoFactorSecret) return reply.status(400).send({ error: '2FA não configurado' });
    const valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: parsed.data.token, window: 1 });
    if (!valid) return reply.status(401).send({ error: 'Código 2FA inválido' });
    return { ok: true, userId: user.id };
  });
}
