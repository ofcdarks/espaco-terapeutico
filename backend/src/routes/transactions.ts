import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transactions } from '../db/schema.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

const createSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  category: z.enum([
    'consulta', 'pacote', 'produto', 'outros_receita',
    'aluguel', 'salario', 'material', 'marketing', 'software', 'outros_despesa',
  ]),
  description: z.string().default(''),
  value: z.number().min(0),
  date: z.string().min(1),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  appointmentId: z.string().optional(),
  paymentMethod: z.enum(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'boleto']).optional(),
  status: z.enum(['pendente', 'pago', 'parcial', 'cancelado']).default('pendente'),
});

const updateSchema = createSchema.partial();

export async function transactionRoutes(app: FastifyInstance) {
  registerCrudRoutes(app, {
    prefix: '/api/transactions',
    table: transactions,
    createSchema,
    updateSchema,
    searchColumn: 'description',
    extraSearchColumns: ['patientName'],
  });
}
