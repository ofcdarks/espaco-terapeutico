import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contracts, contractTemplates, patients, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';
import { registerCrudRoutes } from '../lib/crud-factory.js';
import crypto from 'crypto';

// Default contract templates
const DEFAULT_TEMPLATES = {
  terapia_individual: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICOTERAPIA

CONTRATANTE: {paciente}, CPF {cpf}, residente em {endereco}.
CONTRATADO(A): {profissional}, {crp}, com consultório em {endereco_consultorio}, {cidade}/{estado}.

CLÁUSULA 1 — DO OBJETO
O presente contrato tem por objeto a prestação de serviços de psicoterapia individual, na modalidade {modalidade}, com abordagem {especialidade}.

CLÁUSULA 2 — DAS SESSÕES
2.1. As sessões terão duração de {duracao_sessao} minutos.
2.2. A frequência será de ______ sessão(ões) por semana/quinzena.
2.3. O horário fixo será ______, podendo ser alterado por acordo mútuo.

CLÁUSULA 3 — DOS HONORÁRIOS
3.1. O valor de cada sessão é de R$ {valor_sessao}.
3.2. O pagamento deverá ser efetuado ______ (antes/após cada sessão / mensalmente).
3.3. Reajustes serão comunicados com 30 dias de antecedência.

CLÁUSULA 4 — DO CANCELAMENTO E FALTAS
4.1. Cancelamentos devem ser comunicados com no mínimo 24 horas de antecedência.
4.2. Faltas sem aviso prévio serão cobradas integralmente.

CLÁUSULA 5 — DO SIGILO
5.1. O(A) profissional compromete-se a manter sigilo absoluto sobre todas as informações obtidas durante o processo terapêutico, conforme o Código de Ética Profissional e a LGPD.
5.2. A quebra de sigilo só ocorrerá nos casos previstos em lei (risco iminente à vida).

CLÁUSULA 6 — DA LGPD
6.1. Os dados pessoais serão tratados exclusivamente para fins terapêuticos.
6.2. O paciente tem direito de acesso, correção e exclusão de seus dados.
6.3. Dados não serão compartilhados com terceiros sem consentimento expresso.

CLÁUSULA 7 — DA RESCISÃO
7.1. Qualquer das partes poderá rescindir este contrato mediante comunicação prévia.
7.2. Sessões já agendadas e não canceladas dentro do prazo serão devidas.

CLÁUSULA 8 — DA VIGÊNCIA
Este contrato tem vigência a partir de {data} por prazo indeterminado.

{cidade}, {data_extenso}.


___________________________          ___________________________
{profissional}                       {paciente}
{crp}                                CPF: {cpf}`,
  teleconsulta: `TERMO DE CONSENTIMENTO PARA TELECONSULTA

Eu, {paciente}, CPF {cpf}, DECLARO que:

1. Fui informado(a) que a teleconsulta será realizada por meio digital (videochamada).
2. Compreendo que a qualidade da conexão pode afetar o atendimento.
3. Autorizo a utilização de plataforma digital para a realização da sessão.
4. Estou ciente de que a sessão NÃO será gravada, salvo autorização expressa.
5. Me comprometo a estar em local reservado, garantindo a privacidade do atendimento.
6. Entendo que o sigilo profissional se aplica igualmente ao atendimento online.

Profissional: {profissional} — {crp}
Data: {data_extenso}


___________________________
{paciente}`,
  lgpd: `TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS (LGPD)

Eu, {paciente}, CPF {cpf}, em conformidade com a Lei nº 13.709/2018 (LGPD), AUTORIZO {profissional} ({crp}) a:

1. Coletar e armazenar meus dados pessoais (nome, CPF, contato, endereço).
2. Registrar informações de saúde mental em prontuário eletrônico.
3. Utilizar os dados exclusivamente para fins de acompanhamento terapêutico.

DIREITOS DO TITULAR:
- Acesso aos dados pessoais armazenados
- Correção de dados incompletos ou desatualizados
- Eliminação dos dados (mediante solicitação)
- Portabilidade dos dados

Os dados serão armazenados de forma segura e não serão compartilhados com terceiros sem consentimento prévio, exceto por determinação legal.

Este consentimento pode ser revogado a qualquer momento.

{cidade}, {data_extenso}.


___________________________
{paciente}
CPF: {cpf}`,
};

export async function contractRoutes(app: FastifyInstance) {
  // ── Contract Templates CRUD ───────────────────────────────
  registerCrudRoutes(app, {
    prefix: '/api/contract-templates',
    table: contractTemplates,
    createSchema: z.object({
      name: z.string().min(1), content: z.string().min(1),
      type: z.enum(['terapia_individual', 'terapia_casal', 'terapia_grupo', 'teleconsulta', 'lgpd', 'personalizado']).default('terapia_individual'),
      isDefault: z.boolean().default(false),
    }),
    updateSchema: z.object({ name: z.string().optional(), content: z.string().optional(), type: z.string().optional(), isDefault: z.boolean().optional() }),
    searchColumn: 'name',
  });

  // ── Get default templates ─────────────────────────────────
  app.get('/api/contract-templates/defaults', { preHandler: authGuard }, async () => {
    return Object.entries(DEFAULT_TEMPLATES).map(([type, content]) => ({ type, name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), content }));
  });

  // ── Contracts CRUD ────────────────────────────────────────
  registerCrudRoutes(app, {
    prefix: '/api/contracts',
    table: contracts,
    createSchema: z.object({
      patientId: z.string().min(1), patientName: z.string().default(''), templateId: z.string().optional(),
      title: z.string().min(1), content: z.string().min(1),
      status: z.enum(['rascunho', 'enviado', 'assinado', 'cancelado']).default('rascunho'),
      validUntil: z.string().optional(),
    }),
    updateSchema: z.object({ title: z.string().optional(), content: z.string().optional(), status: z.string().optional(), validUntil: z.string().optional() }),
    searchColumn: 'patientName',
  });

  // ── Generate contract from template with variable replacement ──
  app.post('/api/contracts/generate', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      patientId: z.string().min(1), title: z.string().min(1),
      type: z.enum(['terapia_individual', 'terapia_casal', 'terapia_grupo', 'teleconsulta', 'lgpd', 'personalizado']).default('terapia_individual'),
      customContent: z.string().optional(), validUntil: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const patient = db.select().from(patients).where(and(eq(patients.id, parsed.data.patientId), eq(patients.ownerId, req.user.userId))).get();
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });
    const professional = db.select().from(users).where(eq(users.id, req.user.userId)).get();

    let content = parsed.data.customContent || DEFAULT_TEMPLATES[parsed.data.type as keyof typeof DEFAULT_TEMPLATES] || '';
    const date = new Date().toISOString().split('T')[0];
    const vars: Record<string, string> = {
      '{paciente}': patient.name, '{cpf}': patient.cpf || '___________', '{email}': patient.email,
      '{telefone}': patient.phone, '{endereco}': patient.address || '_______________',
      '{profissional}': professional?.name || '', '{crp}': professional?.registrationNumber || '',
      '{especialidade}': professional?.specialty || '___________', '{consultorio}': professional?.clinicName || '',
      '{endereco_consultorio}': professional?.clinicAddress || '_______________',
      '{cidade}': professional?.clinicCity || '___________', '{estado}': professional?.clinicState || '__',
      '{data}': date.split('-').reverse().join('/'),
      '{data_extenso}': new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      '{valor_sessao}': professional?.sessionPrice ? professional.sessionPrice.toFixed(2) : '___________',
      '{duracao_sessao}': String(professional?.sessionDuration || 50),
      '{modalidade}': professional?.onlineService ? 'online e/ou presencial' : 'presencial',
    };
    for (const [key, val] of Object.entries(vars)) content = content.replaceAll(key, val);

    const [contract] = db.insert(contracts).values({
      ownerId: req.user.userId, patientId: patient.id, patientName: patient.name,
      title: parsed.data.title, content, status: 'rascunho', validUntil: parsed.data.validUntil,
    }).returning().all();
    return reply.status(201).send(contract);
  });

  // ── Public: patient signs contract ────────────────────────
  app.post('/api/contracts/:id/sign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({ patientName: z.string().min(2), cpf: z.string().min(11) }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Nome e CPF obrigatórios' });
    const contract = db.select().from(contracts).where(eq(contracts.id, id)).get();
    if (!contract) return reply.status(404).send({ error: 'Contrato não encontrado' });
    if (contract.status === 'assinado') return reply.status(400).send({ error: 'Contrato já assinado' });
    if (contract.status === 'cancelado') return reply.status(400).send({ error: 'Contrato cancelado' });

    const signatureHash = crypto.createHash('sha256').update(`${parsed.data.patientName}:${parsed.data.cpf}:${new Date().toISOString()}`).digest('hex');
    db.update(contracts).set({
      status: 'assinado', signedAt: new Date().toISOString(),
      signatureHash, signatureIp: req.ip,
    }).where(eq(contracts.id, id)).run();
    return { ok: true, signedAt: new Date().toISOString() };
  });

  // ── Public: view contract for signing ─────────────────────
  app.get('/api/contracts/:id/public', async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = db.select().from(contracts).where(eq(contracts.id, id)).get();
    if (!contract) return reply.status(404).send({ error: 'Contrato não encontrado' });
    return { id: contract.id, title: contract.title, content: contract.content, status: contract.status, signedAt: contract.signedAt, patientName: contract.patientName };
  });

  // ── Print contract ────────────────────────────────────────
  app.get('/api/contracts/:id/print', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.ownerId, req.user.userId))).get();
    if (!contract) return reply.status(404).send({ error: 'Não encontrado' });
    const professional = db.select().from(users).where(eq(users.id, req.user.userId)).get();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Georgia',serif;max-width:700px;margin:40px auto;padding:20px;color:#2a2523;line-height:1.8;font-size:13px}
      .header{text-align:center;border-bottom:2px solid #54423b;padding-bottom:20px;margin-bottom:30px}
      .header h1{color:#54423b;font-size:18px;margin:0;letter-spacing:1px} .header p{color:#b8b0aa;font-size:11px;margin:4px 0}
      .title{font-size:16px;font-weight:bold;text-align:center;margin:25px 0;color:#54423b;text-transform:uppercase;letter-spacing:2px}
      .content{white-space:pre-wrap;font-size:13px;margin:20px 0}
      .status{text-align:center;margin:20px 0;padding:12px;border-radius:8px;font-size:12px}
      .signed{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
      .pending{background:#fff3e0;color:#e65100;border:1px solid #ffcc80}
      @media print{body{margin:0;padding:20px}.status{display:none}}
    </style></head><body>
      <div class="header"><h1>${professional?.clinicName || 'Consultório'}</h1>
        <p>${professional?.name || ''} — ${professional?.registrationNumber || ''}</p>
        <p>${professional?.clinicAddress || ''}</p></div>
      <div class="title">${contract.title}</div>
      <div class="content">${contract.content}</div>
      ${contract.status === 'assinado' ? `<div class="status signed">✓ Assinado digitalmente em ${contract.signedAt?.split('T')[0]?.split('-').reverse().join('/')} — Hash: ${contract.signatureHash?.slice(0, 16)}...</div>` : `<div class="status pending">⏳ Aguardando assinatura</div>`}
      <script>window.print()</script>
    </body></html>`;
    reply.header('Content-Type', 'text/html').send(html);
  });
}
