import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, plans, userSubscriptions, systemConfig } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

function getStripeKey(): string | null {
  const row = db.select().from(systemConfig).where(eq(systemConfig.key, 'stripe.secret_key')).get();
  return row?.value || process.env.STRIPE_SECRET_KEY || null;
}

async function stripe() {
  const key = getStripeKey();
  if (!key) throw new Error('Stripe não configurado');
  const Stripe = (await import('stripe')).default;
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
}

export async function stripeRoutes(app: FastifyInstance) {
  // ── Create checkout session ───────────────────────────────
  app.post('/api/stripe/checkout', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ planId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Plano obrigatório' });
    const plan = db.select().from(plans).where(eq(plans.id, parsed.data.planId)).get();
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' });
    const user = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    try {
      const s = await stripe();
      // Create or get Stripe price
      const priceData: any = {
        currency: 'brl', unit_amount: Math.round(plan.price * 100),
        recurring: plan.interval === 'lifetime' ? undefined : { interval: plan.interval === 'yearly' ? 'year' : 'month' },
        product_data: { name: plan.name, description: plan.description || undefined },
      };
      const session = await s.checkout.sessions.create({
        mode: plan.interval === 'lifetime' ? 'payment' : 'subscription',
        payment_method_types: ['card', 'boleto'],
        customer_email: user?.email,
        line_items: [{ price_data: priceData, quantity: 1 }],
        success_url: `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/configuracoes?payment=success&plan=${plan.id}`,
        cancel_url: `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/configuracoes?payment=cancelled`,
        metadata: { userId: req.user.userId, planId: plan.id },
      });
      return { url: session.url, sessionId: session.id };
    } catch (err: any) {
      app.log.error('Stripe error:', err);
      return reply.status(500).send({ error: `Erro Stripe: ${err.message}` });
    }
  });

  // ── Webhook (Stripe calls this) ───────────────────────────
  app.post('/api/stripe/webhook', { config: { rawBody: true } }, async (req, reply) => {
    const webhookSecret = db.select().from(systemConfig).where(eq(systemConfig.key, 'stripe.webhook_secret')).get()?.value || process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const s = await stripe();
      const sig = req.headers['stripe-signature'] as string;
      let event: any;
      if (webhookSecret && sig) {
        event = s.webhooks.constructEvent(req.rawBody as any, sig, webhookSecret);
      } else {
        event = req.body;
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, planId } = session.metadata;
        if (userId && planId) {
          const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
          const endDate = plan?.interval === 'yearly'
            ? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
            : plan?.interval === 'lifetime' ? '2099-12-31'
            : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
          db.insert(userSubscriptions).values({
            userId, planId, status: 'active',
            startDate: new Date().toISOString().split('T')[0], endDate,
          }).run();
        }
      }
      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          db.update(userSubscriptions).set({ status: 'cancelled' })
            .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active'))).run();
        }
      }
      return { received: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ── Get user's subscription ───────────────────────────────
  app.get('/api/stripe/subscription', { preHandler: authGuard }, async (req) => {
    const sub = db.select().from(userSubscriptions)
      .where(and(eq(userSubscriptions.userId, req.user.userId), eq(userSubscriptions.status, 'active'))).get();
    if (!sub) return { active: false, plan: null };
    const plan = db.select().from(plans).where(eq(plans.id, sub.planId)).get();
    return { active: true, subscription: sub, plan };
  });

  // ── Get available plans (public) ──────────────────────────
  app.get('/api/stripe/plans', async () => {
    return db.select().from(plans).where(eq(plans.isActive, true)).all();
  });

  // ── Create PIX payment link ───────────────────────────────
  app.post('/api/stripe/pix', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ planId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Plano obrigatório' });
    const plan = db.select().from(plans).where(eq(plans.id, parsed.data.planId)).get();
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' });
    try {
      const s = await stripe();
      const pi = await s.paymentIntents.create({
        amount: Math.round(plan.price * 100), currency: 'brl',
        payment_method_types: ['pix'],
        metadata: { userId: req.user.userId, planId: plan.id },
      });
      return { clientSecret: pi.client_secret, amount: plan.price };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
