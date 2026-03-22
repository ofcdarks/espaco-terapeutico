import { FastifyInstance, FastifyRequest } from 'fastify';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { z, ZodSchema } from 'zod';
import { db } from '../db/index.js';
import { authGuard } from '../middleware/auth.js';

interface CrudOptions<TCreate extends ZodSchema, TUpdate extends ZodSchema> {
  /** Route prefix, e.g. '/api/patients' */
  prefix: string;
  /** Drizzle table reference */
  table: any;
  /** Zod schema for creation */
  createSchema: TCreate;
  /** Zod schema for update (all optional) */
  updateSchema: TUpdate;
  /** Column to use for text search (optional) */
  searchColumn?: string;
  /** Extra columns to search in (optional) */
  extraSearchColumns?: string[];
  /** Transform before insert (e.g., denormalize patientName) */
  beforeCreate?: (data: z.infer<TCreate>, request: FastifyRequest) => Record<string, unknown>;
  /** Transform before update */
  beforeUpdate?: (data: z.infer<TUpdate>, request: FastifyRequest) => Record<string, unknown>;
}

export function registerCrudRoutes<TCreate extends ZodSchema, TUpdate extends ZodSchema>(
  app: FastifyInstance,
  opts: CrudOptions<TCreate, TUpdate>
) {
  const { prefix, table, createSchema, updateSchema, searchColumn, extraSearchColumns, beforeCreate, beforeUpdate } = opts;

  // ── LIST (with search & pagination) ───────────────────────
  app.get(prefix, { preHandler: authGuard }, async (request) => {
    const { search, page = '1', limit = '50' } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let conditions = [eq(table.ownerId, request.user.userId)];

    if (search && searchColumn) {
      const searchConditions = [like(table[searchColumn], `%${search}%`)];
      if (extraSearchColumns) {
        for (const col of extraSearchColumns) {
          if (table[col]) {
            searchConditions.push(like(table[col], `%${search}%`));
          }
        }
      }
      conditions.push(or(...searchConditions)!);
    }

    const items = db
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(desc(table.createdAt))
      .limit(limitNum)
      .offset(offset)
      .all();

    const [{ count }] = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(and(...conditions))
      .all();

    return {
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  });

  // ── GET BY ID ─────────────────────────────────────────────
  app.get(`${prefix}/:id`, { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.ownerId, request.user.userId)))
      .get();

    if (!item) {
      return reply.status(404).send({ error: 'Não encontrado' });
    }

    return item;
  });

  // ── CREATE ────────────────────────────────────────────────
  app.post(prefix, { preHandler: authGuard }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    let data: Record<string, unknown> = {
      ...parsed.data,
      ownerId: request.user.userId,
    };

    if (beforeCreate) {
      data = { ...data, ...beforeCreate(parsed.data, request) };
    }

    const [item] = db.insert(table).values(data).returning().all();
    return reply.status(201).send(item);
  });

  // ── UPDATE ────────────────────────────────────────────────
  app.patch(`${prefix}/:id`, { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const existing = db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.ownerId, request.user.userId)))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Não encontrado' });
    }

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    // Remove undefined fields
    let updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data as Record<string, unknown>)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    if (beforeUpdate) {
      updates = { ...updates, ...beforeUpdate(parsed.data, request) };
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    db.update(table).set(updates).where(eq(table.id, id)).run();

    return db
      .select()
      .from(table)
      .where(eq(table.id, id))
      .get();
  });

  // ── DELETE ────────────────────────────────────────────────
  app.delete(`${prefix}/:id`, { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.ownerId, request.user.userId)))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Não encontrado' });
    }

    db.delete(table).where(eq(table.id, id)).run();
    return reply.status(204).send();
  });
}
