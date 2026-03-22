import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { documents, documentTemplates, patients, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';

export async function pdfRoutes(app: FastifyInstance) {
  // Document templates CRUD
  registerCrudRoutes(app, {
    prefix: '/api/document-templates',
    table: documentTemplates,
    createSchema: z.object({
      type: z.enum(['recibo','atestado','declaracao','relatorio','receituario']),
      name: z.string().min(1), content: z.string().min(1), isDefault: z.boolean().default(false),
    }),
    updateSchema: z.object({
      name: z.string().optional(), content: z.string().optional(), isDefault: z.boolean().optional(),
    }),
    searchColumn: 'name',
  });

  // Generate document from template with variable replacement
  app.post('/api/documents/generate', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      templateId: z.string().optional(),
      patientId: z.string().min(1),
      type: z.enum(['recibo','atestado','declaracao','relatorio','receituario']),
      title: z.string().min(1),
      customContent: z.string().optional(),
      date: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const patient = db.select().from(patients).where(and(eq(patients.id, parsed.data.patientId), eq(patients.ownerId, req.user.userId))).get();
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });
    const professional = db.select().from(users).where(eq(users.id, req.user.userId)).get();

    let content = parsed.data.customContent || '';
    if (parsed.data.templateId) {
      const template = db.select().from(documentTemplates).where(eq(documentTemplates.id, parsed.data.templateId)).get();
      if (template) content = template.content;
    }

    // Replace variables
    const date = parsed.data.date || new Date().toISOString().split('T')[0];
    const vars: Record<string, string> = {
      '{paciente}': patient.name, '{cpf}': patient.cpf || '', '{email}': patient.email,
      '{telefone}': patient.phone, '{endereco}': patient.address || '',
      '{profissional}': professional?.name || '', '{crp}': professional?.registrationNumber || '',
      '{especialidade}': professional?.specialty || '', '{consultorio}': professional?.clinicName || '',
      '{endereco_consultorio}': professional?.clinicAddress || '',
      '{cidade}': professional?.clinicCity || '', '{estado}': professional?.clinicState || '',
      '{data}': date.split('-').reverse().join('/'),
      '{data_extenso}': new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
    for (const [key, val] of Object.entries(vars)) {
      content = content.replaceAll(key, val);
    }

    const [doc] = db.insert(documents).values({
      ownerId: req.user.userId, type: parsed.data.type, patientId: patient.id,
      patientName: patient.name, title: parsed.data.title, content, date,
    }).returning().all();

    return reply.status(201).send(doc);
  });

  // Get HTML for printing (client renders and uses window.print)
  app.get('/api/documents/:id/print', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = db.select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerId, req.user.userId))).get();
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado' });
    const professional = db.select().from(users).where(eq(users.id, req.user.userId)).get();

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333;line-height:1.6}
      .header{text-align:center;border-bottom:2px solid #7c5aff;padding-bottom:20px;margin-bottom:30px}
      .header h1{color:#7c5aff;font-size:20px;margin:0} .header p{color:#666;font-size:12px;margin:4px 0}
      .title{font-size:18px;font-weight:bold;text-align:center;margin:20px 0}
      .content{white-space:pre-wrap;font-size:14px;margin:20px 0}
      .footer{border-top:1px solid #ddd;padding-top:20px;margin-top:40px;text-align:center}
      .signature{margin-top:60px;text-align:center} .signature-line{border-top:1px solid #333;width:250px;margin:0 auto;padding-top:8px}
      @media print{body{margin:0;padding:20px}}
    </style></head><body>
      <div class="header"><h1>${professional?.clinicName || 'Consultório'}</h1>
        <p>${professional?.name || ''} — ${professional?.registrationNumber || ''}</p>
        <p>${professional?.clinicAddress || ''} ${professional?.clinicCity ? '— ' + professional.clinicCity + '/' + professional.clinicState : ''}</p></div>
      <div class="title">${doc.title}</div>
      <div class="content">${doc.content}</div>
      <div class="signature"><div class="signature-line">${professional?.name || ''}<br/>${professional?.registrationNumber || ''}</div></div>
      <div class="footer"><small>${doc.date?.split('-').reverse().join('/')}</small></div>
      <script>window.print()</script>
    </body></html>`;
    reply.header('Content-Type', 'text/html').send(html);
  });
}
