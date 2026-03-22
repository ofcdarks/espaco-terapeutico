import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { records } from '../db/schema.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

const createSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string().min(1),
  patientName: z.string().default(''),
  date: z.string().min(1),
  diagnosis: z.string().optional(),
  cid10: z.string().optional(),
  treatment: z.string().optional(),
  observations: z.string().optional(),
  prescriptions: z.string().optional(),
  attachments: z.string().optional(), // JSON array
});

const updateSchema = createSchema.partial();

export async function recordRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/records',
    table: records,
    createSchema,
    updateSchema,
    searchColumn: 'patientName',
  });
}
