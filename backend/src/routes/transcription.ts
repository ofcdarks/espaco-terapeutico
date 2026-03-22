import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sessionTranscripts, systemConfig, patients } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

function getConfig(key: string): string {
  const row = db.select().from(systemConfig).where(eq(systemConfig.key, key)).get();
  return row?.value || '';
}

export async function transcriptionRoutes(app: FastifyInstance) {
  // ── List sessionTranscripts for a patient ─────────────────────
  app.get('/api/sessionTranscripts', { preHandler: authGuard }, async (req) => {
    const { patientId, limit = '20' } = req.query as any;
    let conditions = [eq(sessionTranscripts.ownerId, req.user.userId)];
    if (patientId) conditions.push(eq(sessionTranscripts.patientId, patientId));
    return db.select().from(sessionTranscripts).where(and(...conditions)).orderBy(desc(sessionTranscripts.createdAt)).limit(parseInt(limit)).all();
  });

  // ── Save manual transcription ─────────────────────────────
  app.post('/api/sessionTranscripts', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      appointmentId: z.string().optional(),
      patientId: z.string().optional(),
      patientName: z.string().default(''),
      sessionDate: z.string().min(1),
      durationMinutes: z.number().optional(),
      rawTranscription: z.string().min(1),
      provider: z.enum(['downsub', 'whisper', 'web_speech', 'manual']).default('manual'),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    // Auto-fill patient name
    let patientName = parsed.data.patientName;
    if (!patientName && parsed.data.patientId) {
      const p = db.select().from(patients).where(eq(patients.id, parsed.data.patientId)).get();
      if (p) patientName = p.name;
    }

    const [item] = db.insert(sessionTranscripts).values({
      ...parsed.data, patientName, ownerId: req.user.userId, status: 'done',
    }).returning().all();
    return reply.status(201).send(item);
  });

  // ── Transcribe via Downsub API ────────────────────────────
  app.post('/api/sessionTranscripts/downsub', { preHandler: authGuard }, async (req, reply) => {
    const parsed = z.object({
      audioUrl: z.string().url().optional(),
      audioBase64: z.string().optional(),
      patientId: z.string().optional(),
      patientName: z.string().default(''),
      sessionDate: z.string().min(1),
      appointmentId: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const apiUrl = getConfig('downsub_api_url');
    const apiKey = getConfig('downsub_api_key');
    if (!apiUrl || !apiKey) return reply.status(400).send({ error: 'Downsub API não configurada. Configure no painel admin.' });

    // Create pending transcription
    const [item] = db.insert(sessionTranscripts).values({
      ownerId: req.user.userId, patientId: parsed.data.patientId,
      patientName: parsed.data.patientName, sessionDate: parsed.data.sessionDate,
      appointmentId: parsed.data.appointmentId,
      rawTranscription: '', status: 'transcribing', provider: 'downsub',
    }).returning().all();

    // Call Downsub API async
    (async () => {
      try {
        const body: any = { language: 'pt-BR' };
        if (parsed.data.audioUrl) body.url = parsed.data.audioUrl;
        if (parsed.data.audioBase64) body.audio = parsed.data.audioBase64;

        const res = await fetch(`${apiUrl}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Downsub error: ${res.status}`);
        const data = await res.json() as any;
        const text = data.transcription || data.text || data.result || '';

        db.update(sessionTranscripts).set({ rawTranscription: text, status: 'done' }).where(eq(sessionTranscripts.id, item.id)).run();
      } catch (err: any) {
        app.log.error('[Downsub] Error:', err.message);
        db.update(sessionTranscripts).set({ status: 'error', rawTranscription: `Erro: ${err.message}` }).where(eq(sessionTranscripts.id, item.id)).run();
      }
    })();

    return { id: item.id, status: 'transcribing', message: 'Transcrição em andamento. Acompanhe o status.' };
  });

  // ── Analyze transcription with AI (Laozhang) ─────────────
  app.post('/api/sessionTranscripts/:id/analyze', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const trans = db.select().from(sessionTranscripts).where(and(eq(sessionTranscripts.id, id), eq(sessionTranscripts.ownerId, req.user.userId))).get();
    if (!trans) return reply.status(404).send({ error: 'Transcrição não encontrada' });
    if (!trans.rawTranscription) return reply.status(400).send({ error: 'Transcrição vazia' });

    const aiUrl = getConfig('ai_api_url');
    const aiKey = getConfig('ai_api_key');
    const aiModel = getConfig('ai_model') || 'deepseek-v3';

    if (!aiUrl || !aiKey) return reply.status(400).send({ error: 'API de IA não configurada. Configure no painel admin.' });

    db.update(sessionTranscripts).set({ status: 'analyzing' }).where(eq(sessionTranscripts.id, id)).run();

    try {
      const systemPrompt = `Você é um assistente de psicologia clínica. Analise a transcrição e retorne JSON:
{
  "summary": "Resumo em 3-4 frases",
  "keyTopics": ["tópico1", "tópico2"],
  "emotionalState": "Estado emocional observado",
  "suggestedFollowUp": ["sugestão1", "sugestão2"],
  "preDiagnosis": "Observações clínicas preliminares",
  "riskIndicators": ["indicador"] ou null,
  "therapeuticNotes": "Notas para o terapeuta",
  "suggestedRecordText": "Texto sugerido para prontuário (pronto para copiar)"
}
Responda APENAS JSON válido.`;

      const res = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Paciente: ${trans.patientName}\nDuração: ${trans.durationMinutes || '?'} min\n\nTranscrição:\n${trans.rawTranscription}` },
          ],
          temperature: 0.7, max_tokens: 2000,
        }),
      });

      if (!res.ok) throw new Error(`AI API error: ${res.status}`);
      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content };

      db.update(sessionTranscripts).set({ aiAnalysis: JSON.stringify(analysis), status: 'done' }).where(eq(sessionTranscripts.id, id)).run();

      return { ...analysis, transcriptionId: id };
    } catch (err: any) {
      db.update(sessionTranscripts).set({ status: 'error' }).where(eq(sessionTranscripts.id, id)).run();
      return reply.status(500).send({ error: `Erro na análise: ${err.message}` });
    }
  });

  // ── Get transcription with analysis ───────────────────────
  app.get('/api/sessionTranscripts/:id', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = db.select().from(sessionTranscripts).where(and(eq(sessionTranscripts.id, id), eq(sessionTranscripts.ownerId, req.user.userId))).get();
    if (!item) return reply.status(404).send({ error: 'Não encontrada' });
    return { ...item, aiAnalysis: item.aiAnalysis ? JSON.parse(item.aiAnalysis) : null };
  });
}
