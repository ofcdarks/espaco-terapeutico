import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { systemConfig } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authGuard } from '../middleware/auth.js';

function getConfig(key: string): string | null {
  const row = db.select().from(systemConfig).where(eq(systemConfig.key, key)).get();
  return row?.value || null;
}

const analyzeSchema = z.object({
  transcription: z.string().min(1),
  patientName: z.string().min(1),
  sessionDuration: z.number(),
  previousNotes: z.string().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  app.post('/api/ai/analyze-session', { preHandler: authGuard }, async (request, reply) => {
    const parsed = analyzeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const { transcription, patientName, sessionDuration, previousNotes } = parsed.data;

    // Read from admin config (system_config table) first, then env vars
    const AI_API_URL = getConfig('ai.api_url') || process.env.AI_API_URL || 'https://api.laozhang.ai/v1/chat/completions';
    const AI_API_KEY = getConfig('ai.api_key') || process.env.AI_API_KEY;
    const AI_MODEL = getConfig('ai.model') || process.env.AI_MODEL || 'deepseek-v3';

    if (!AI_API_KEY) {
      app.log.warn('No AI API key configured — using local analysis');
      return performLocalAnalysis({ transcription, patientName, sessionDuration });
    }

    const systemPrompt = `Você é um assistente especializado em psicologia clínica.
Analise a sessão terapêutica e gere uma análise estruturada.
Responda APENAS em JSON válido:
{
  "summary": "Resumo em 2-3 frases",
  "keyTopics": ["tópico1", "tópico2"],
  "emotionalState": "Estado emocional observado",
  "suggestedFollowUp": ["sugestão1", "sugestão2"],
  "preDiagnosis": "Observações clínicas preliminares",
  "riskIndicators": ["indicador"] ou null,
  "therapeuticNotes": "Notas para o terapeuta"
}`;

    const userPrompt = `Paciente: ${patientName}
Duração: ${sessionDuration} minutos
${previousNotes ? `Notas anteriores: ${previousNotes}` : ''}

Conteúdo da sessão:
${transcription}

Analise e responda em JSON.`;

    try {
      app.log.info(`AI request to ${AI_API_URL} with model ${AI_MODEL}`);
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.7, max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        app.log.error(`AI API error ${response.status}: ${errText}`);
        return performLocalAnalysis({ transcription, patientName, sessionDuration });
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return performLocalAnalysis({ transcription, patientName, sessionDuration });

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return performLocalAnalysis({ transcription, patientName, sessionDuration });

      const analysis = JSON.parse(jsonMatch[0]);
      return {
        summary: analysis.summary || 'Análise concluída.',
        keyTopics: analysis.keyTopics || [],
        emotionalState: analysis.emotionalState || 'Não identificado',
        suggestedFollowUp: analysis.suggestedFollowUp || [],
        preDiagnosis: analysis.preDiagnosis || '',
        riskIndicators: analysis.riskIndicators || null,
        therapeuticNotes: analysis.therapeuticNotes || '',
        source: 'ai',
      };
    } catch (err: any) {
      app.log.error(`AI analysis error: ${err.message}`);
      return performLocalAnalysis({ transcription, patientName, sessionDuration });
    }
  });
}

function performLocalAnalysis(req: { transcription: string; patientName: string; sessionDuration: number }) {
  const words = req.transcription.toLowerCase();
  const emotions: Record<string, string[]> = {
    ansiedade: ['ansioso', 'ansiedade', 'nervoso', 'preocupado', 'medo', 'pânico'],
    tristeza: ['triste', 'deprimido', 'desanimado', 'sem esperança', 'vazio'],
    raiva: ['raiva', 'irritado', 'frustrado', 'bravo'],
    estresse: ['estresse', 'estressado', 'cansado', 'esgotado', 'sobrecarregado'],
    positivo: ['melhor', 'bem', 'feliz', 'animado', 'esperança', 'progresso'],
  };
  const detected = Object.entries(emotions).filter(([_, kws]) => kws.some(k => words.includes(k))).map(([e]) => e);
  const topics = ['trabalho', 'família', 'relacionamento', 'saúde', 'sono', 'alimentação', 'autoestima'].filter(t => words.includes(t));
  const risks = ['suicídio', 'morrer', 'acabar com tudo', 'não aguento mais'].filter(k => words.includes(k));

  return {
    summary: `Sessão de ${req.sessionDuration} minutos com ${req.patientName}. ${topics.length > 0 ? `Principais temas: ${topics.join(', ')}.` : 'Temas gerais de acompanhamento.'}`,
    keyTopics: topics.length > 0 ? topics : ['Acompanhamento geral'],
    emotionalState: detected.length > 0 ? detected.join(', ') : 'Estável',
    suggestedFollowUp: ['Continuar acompanhamento regular'],
    preDiagnosis: detected.length > 0 ? `Possíveis indicadores de ${detected.join(' e ')}.` : 'Sem indicadores significativos.',
    riskIndicators: risks.length > 0 ? risks : null,
    therapeuticNotes: risks.length > 0 ? 'ATENÇÃO: Indicadores de risco detectados.' : 'Sem indicadores de risco imediato.',
    source: 'local',
  };
}

// AI-assisted anamnese generation
export async function aiAnamneseRoute(app: FastifyInstance) {
  app.post('/api/ai/anamnese', { preHandler: authGuard }, async (request, reply) => {
    const parsed = z.object({
      patientName: z.string().min(1),
      symptoms: z.string().optional(),
      context: z.string().optional(),
      field: z.enum(['treatment', 'observations', 'prescriptions', 'diagnosis']),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });

    const { patientName, symptoms, context, field } = parsed.data;
    const AI_API_URL = getConfig('ai.api_url') || process.env.AI_API_URL || 'https://api.laozhang.ai/v1/chat/completions';
    const AI_API_KEY = getConfig('ai.api_key') || process.env.AI_API_KEY;
    const AI_MODEL = getConfig('ai.model') || process.env.AI_MODEL || 'deepseek-v3';

    const prompts: Record<string, string> = {
      treatment: `Gere um plano terapêutico detalhado para o paciente ${patientName}. ${symptoms ? `Queixas: ${symptoms}.` : ''} ${context ? `Contexto: ${context}.` : ''} Inclua abordagem terapêutica, objetivos, técnicas e frequência sugerida. Escreva em português, de forma profissional para prontuário clínico.`,
      observations: `Gere observações clínicas de sessão para o paciente ${patientName}. ${symptoms ? `Queixas: ${symptoms}.` : ''} ${context ? `Contexto: ${context}.` : ''} Descreva comportamento observado, estado emocional, temas discutidos e evolução. Escreva em português profissional.`,
      prescriptions: `Gere sugestões de encaminhamentos e recomendações para o paciente ${patientName}. ${symptoms ? `Queixas: ${symptoms}.` : ''} Inclua encaminhamentos, exercícios terapêuticos e orientações para casa. Escreva em português profissional.`,
      diagnosis: `Sugira hipóteses diagnósticas (CID-10) para o paciente ${patientName} com base em: ${symptoms || 'sintomas gerais'}. ${context ? `Contexto: ${context}.` : ''} Liste os códigos CID-10 relevantes com descrição. Escreva em português.`,
    };

    if (!AI_API_KEY) {
      return reply.send({ text: `[IA não configurada] Preencha manualmente o campo de ${field} para ${patientName}.`, source: 'fallback' });
    }

    try {
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: 'Você é um assistente de psicologia clínica. Gere textos profissionais para prontuário. Responda diretamente o texto solicitado, sem formatação JSON.' },
            { role: 'user', content: prompts[field] },
          ],
          temperature: 0.7, max_tokens: 1000,
        }),
      });
      if (!response.ok) return reply.send({ text: 'Erro na API de IA. Preencha manualmente.', source: 'error' });
      const data = await response.json() as any;
      return { text: data.choices?.[0]?.message?.content || '', source: 'ai' };
    } catch (err: any) {
      app.log.error(`AI anamnese error: ${err.message}`);
      return { text: 'Erro ao gerar. Preencha manualmente.', source: 'error' };
    }
  });
}
