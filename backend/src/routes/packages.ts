import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { packages } from '../db/schema.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sessions: z.number().min(1).default(1),
  value: z.number().min(0).default(0),
  validity: z.number().min(1).default(30),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

export async function packageRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/packages',
    table: packages,
    createSchema,
    updateSchema,
    searchColumn: 'name',
  });
}
