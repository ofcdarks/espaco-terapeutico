import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { patients } from '../db/schema.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email().or(z.literal('')).default(''),
  phone: z.string().default(''),
  birthDate: z.string().default(''),
  cpf: z.string().default(''),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  packageId: z.string().optional(),
  sessionsRemaining: z.number().optional(),
});

const updateSchema = createSchema.partial();

export async function patientRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/patients',
    table: patients,
    createSchema,
    updateSchema,
    searchColumn: 'name',
    extraSearchColumns: ['email', 'cpf', 'phone'],
  });
}
