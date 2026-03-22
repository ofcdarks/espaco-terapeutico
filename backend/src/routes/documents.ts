import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { documents } from '../db/schema.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

const createSchema = z.object({
  type: z.enum(['recibo', 'atestado', 'declaracao', 'relatorio', 'receituario']),
  patientId: z.string().min(1),
  patientName: z.string().default(''),
  appointmentId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().default(''),
  date: z.string().min(1),
});

const updateSchema = createSchema.partial();

export async function documentRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/documents',
    table: documents,
    createSchema,
    updateSchema,
    searchColumn: 'title',
    extraSearchColumns: ['patientName'],
  });
}
