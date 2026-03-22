import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patients } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

export async function csvRoutes(app: FastifyInstance) {
  // Export patients as CSV
  app.get('/api/csv/patients/export', { preHandler: authGuard }, async (req, reply) => {
    const data = db.select().from(patients).where(eq(patients.ownerId, req.user.userId)).all();
    const headers = 'nome,email,telefone,data_nascimento,cpf,endereco,status,notas\n';
    const rows = data.map(p =>
      `"${p.name}","${p.email}","${p.phone}","${p.birthDate}","${p.cpf}","${p.address||''}","${p.status}","${(p.notes||'').replace(/"/g,'""')}"`
    ).join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename=pacientes.csv');
    return '\ufeff' + headers + rows;
  });

  // Import patients from CSV
  app.post('/api/csv/patients/import', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({ csv: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'CSV obrigatório' });
    const lines = parsed.data.csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) return reply.status(400).send({ error: 'CSV vazio' });
    const header = lines[0].toLowerCase();
    if (!header.includes('nome')) return reply.status(400).send({ error: 'CSV deve ter coluna "nome"' });
    const cols = header.split(',').map(c => c.trim().replace(/"/g, ''));
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
      const row: Record<string, string> = {};
      cols.forEach((c, j) => { row[c] = vals[j] || ''; });
      if (!row.nome) continue;
      db.insert(patients).values({
        ownerId: req.user.userId, name: row.nome, email: row.email || '',
        phone: row.telefone || '', birthDate: row.data_nascimento || '',
        cpf: row.cpf || '', address: row.endereco || '', notes: row.notas || '', status: 'ativo',
      }).run();
      imported++;
    }
    return { imported, total: lines.length - 1 };
  });
}
