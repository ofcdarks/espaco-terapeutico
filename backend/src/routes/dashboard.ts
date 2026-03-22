import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { patients, appointments, transactions } from '../db/schema.js';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard/stats', { preHandler: authGuard }, async (request) => {
    const ownerId = request.user.userId;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

    // All queries scoped to ownerId — multi-tenant isolation
    const [patientCount] = db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(eq(patients.ownerId, ownerId))
      .all();

    const [appointmentCount] = db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(eq(appointments.ownerId, ownerId))
      .all();

    const [todayCount] = db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(and(eq(appointments.ownerId, ownerId), eq(appointments.date, today)))
      .all();

    const [weekCount] = db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.ownerId, ownerId),
          gte(appointments.date, today),
          lte(appointments.date, weekEnd)
        )
      )
      .all();

    const [completedMonth] = db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.ownerId, ownerId),
          eq(appointments.status, 'concluido'),
          gte(appointments.date, monthStart),
          lte(appointments.date, monthEnd)
        )
      )
      .all();

    const [canceledMonth] = db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.ownerId, ownerId),
          eq(appointments.status, 'cancelado'),
          gte(appointments.date, monthStart),
          lte(appointments.date, monthEnd)
        )
      )
      .all();

    const [revenue] = db
      .select({ total: sql<number>`coalesce(sum(value), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, ownerId),
          eq(transactions.type, 'receita'),
          eq(transactions.status, 'pago'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      )
      .all();

    const [expenses] = db
      .select({ total: sql<number>`coalesce(sum(value), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, ownerId),
          eq(transactions.type, 'despesa'),
          eq(transactions.status, 'pago'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      )
      .all();

    const [pending] = db
      .select({ total: sql<number>`coalesce(sum(value), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, ownerId),
          eq(transactions.type, 'receita'),
          eq(transactions.status, 'pendente')
        )
      )
      .all();

    return {
      totalPatients: patientCount.count,
      totalAppointments: appointmentCount.count,
      todayAppointments: todayCount.count,
      weekAppointments: weekCount.count,
      completedThisMonth: completedMonth.count,
      canceledThisMonth: canceledMonth.count,
      monthRevenue: revenue.total,
      monthExpenses: expenses.total,
      pendingPayments: pending.total,
    };
  });

  // ── Monthly revenue chart data (last 12 months) ───────────
  app.get('/api/dashboard/revenue-chart', { preHandler: authGuard }, async (request) => {
    const ownerId = request.user.userId;

    const rows = db.all(sql`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'receita' AND status = 'pago' THEN value ELSE 0 END) as receita,
        SUM(CASE WHEN type = 'despesa' AND status = 'pago' THEN value ELSE 0 END) as despesa
      FROM transactions
      WHERE owner_id = ${ownerId}
        AND date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month ASC
    `);

    return rows;
  });
}
