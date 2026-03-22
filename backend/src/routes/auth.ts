import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, passwordResetTokens } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import {
  hashPassword, verifyPassword, generateAccessToken, generateRefreshToken,
  saveRefreshToken, validateRefreshToken, revokeRefreshToken, revokeAllUserTokens,
} from '../lib/auth.js';
import { authGuard } from '../middleware/auth.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  category: z.enum(['terapeuta', 'sexologo', 'psicologo', 'psicanalista', 'constelador']).default('psicologo'),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const { name, email, password, category } = parsed.data;
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) return reply.status(409).send({ error: 'Este email já está cadastrado' });
    const pwHash = await hashPassword(password);
    const [user] = db.insert(users).values({ name, email, passwordHash: pwHash, category })
      .returning({ id: users.id, name: users.name, email: users.email, category: users.category, isAdmin: users.isAdmin }).all();
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);
    return reply.status(201).send({ user, accessToken, refreshToken });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Credenciais inválidas' });
    const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
    if (!user) return reply.status(401).send({ error: 'Email ou senha incorretos' });
    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Email ou senha incorretos' });
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);
    return { user: { id: user.id, name: user.name, email: user.email, category: user.category, phone: user.phone, isAdmin: user.isAdmin }, accessToken, refreshToken };
  });

  app.post('/api/auth/refresh', async (req, reply) => {
    const parsed = z.object({ refreshToken: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Refresh token obrigatório' });
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Access token obrigatório' });
    let userId: string;
    try {
      const payload = JSON.parse(Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString());
      userId = payload.userId;
    } catch { return reply.status(401).send({ error: 'Token malformado' }); }
    const valid = await validateRefreshToken(userId, parsed.data.refreshToken);
    if (!valid) return reply.status(401).send({ error: 'Refresh token inválido' });
    await revokeRefreshToken(userId, parsed.data.refreshToken);
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return reply.status(401).send({ error: 'Usuário não encontrado' });
    const newAccess = generateAccessToken({ userId: user.id, email: user.email });
    const newRefresh = generateRefreshToken();
    await saveRefreshToken(user.id, newRefresh);
    return { accessToken: newAccess, refreshToken: newRefresh };
  });

  app.post('/api/auth/logout', { preHandler: authGuard }, async (req) => {
    await revokeAllUserTokens(req.user.userId);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: authGuard }, async (req, reply) => {
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' });
    const { passwordHash, ...profile } = user;
    return profile;
  });

  app.patch('/api/auth/me', { preHandler: authGuard }, async (req) => {
    const schema = z.object({
      name: z.string().min(2).optional(), phone: z.string().optional(), category: z.enum(['terapeuta', 'sexologo', 'psicologo', 'psicanalista', 'constelador']).optional(),
      bio: z.string().optional(), registrationNumber: z.string().optional(), specialty: z.string().optional(), approaches: z.array(z.string()).optional(),
      sessionDuration: z.number().optional(), sessionPrice: z.number().optional(), clinicName: z.string().optional(), clinicAddress: z.string().optional(),
      clinicCity: z.string().optional(), clinicState: z.string().optional(), onlineService: z.boolean().optional(), inPersonService: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
    const { approaches, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
    if (approaches) updates.approaches = JSON.stringify(approaches);
    db.update(users).set(updates).where(eq(users.id, req.user.userId)).run();
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    const { passwordHash, ...profile } = user!;
    return profile;
  });

  app.post('/api/auth/change-password', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' });
    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Senha atual incorreta' });
    db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date().toISOString() }).where(eq(users.id, req.user.userId)).run();
    await revokeAllUserTokens(req.user.userId);
    return { ok: true, message: 'Senha alterada. Faça login novamente.' };
  });

  // ── P1 FIX: Password Reset ────────────────────────────────
  app.post('/api/auth/forgot-password', async (req, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Email inválido' });
    const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
    // Always return success to prevent email enumeration
    if (!user) return { ok: true, message: 'Se o email existir, um link de recuperação será enviado.' };
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt }).run();
    // In production, send email with: /auth?reset=TOKEN
    // For now, log it (the token would be sent via email service like Resend/SES)
    app.log.info(`[Password Reset] Token for ${user.email}: ${token}`);
    return { ok: true, message: 'Se o email existir, um link de recuperação será enviado.', ...(process.env.NODE_ENV !== 'production' ? { _devToken: token } : {}) };
  });

  app.post('/api/auth/reset-password', async (req, reply) => {
    const parsed = z.object({ token: z.string().min(1), newPassword: z.string().min(6) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const now = new Date().toISOString();
    const record = db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, now))).get();
    if (!record || record.usedAt) return reply.status(400).send({ error: 'Token inválido ou expirado' });
    db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, record.id)).run();
    db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: now }).where(eq(users.id, record.userId)).run();
    await revokeAllUserTokens(record.userId);
    return { ok: true, message: 'Senha redefinida com sucesso.' };
  });
}
