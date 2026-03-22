import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';

const analyzeSchema = z.object({
  transcription: z.string().min(1),
  patientName: z.string().min(1),
  sessionDuration: z.number(),
  previousNotes: z.string().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  app.post('/api/ai/analyze-session', { preHandler: authGuard }, async (request, reply) => {
    const parsed = analyzeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { transcription, patientName, sessionDuration, previousNotes } = parsed.data;

    // AI API config — key stays server-side, never reaches the browser
    const AI_API_URL = process.env.AI_API_URL || 'https://api.laozhang.ai/v1/chat/completions';
    const AI_API_KEY = process.env.AI_API_KEY;
    const AI_MODEL = process.env.AI_MODEL || 'deepseek-v3';

    if (!AI_API_KEY) {
      // Fallback to local analysis when no API key configured
      return performLocalAnalysis({ transcription, patientName, sessionDuration });
    }

    const systemPrompt = `Você é um assistente especializado em psicologia clínica e terapia.
Analise a transcrição da sessão terapêutica fornecida e gere uma análise estruturada.

IMPORTANTE: Responda APENAS em JSON válido, sem texto adicional antes ou depois.

O JSON deve ter exatamente esta estrutura:
{
  "summary": "Resumo da sessão em 2-3 frases",
  "keyTopics": ["tópico1", "tópico2", "tópico3"],
  "emotionalState": "Descrição do estado emocional observado",
  "suggestedFollowUp": ["sugestão1", "sugestão2"],
  "preDiagnosis": "Observações clínicas preliminares (não é diagnóstico definitivo)",
  "riskIndicators": ["indicador1"] ou null se não houver,
  "therapeuticNotes": "Notas para o terapeuta sobre a sessão"
}`;

    const userPrompt = `Paciente: ${patientName}
Duração da sessão: ${sessionDuration} minutos
${previousNotes ? `Notas anteriores: ${previousNotes}` : ''}

Transcrição da sessão:
${transcription}

Analise esta sessão e forneça a análise estruturada em JSON.`;

    try {
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        app.log.error(`AI API error: ${response.status}`);
        return performLocalAnalysis({ transcription, patientName, sessionDuration });
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return performLocalAnalysis({ transcription, patientName, sessionDuration });
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return performLocalAnalysis({ transcription, patientName, sessionDuration });
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return {
        summary: analysis.summary || 'Análise da sessão concluída.',
        keyTopics: analysis.keyTopics || ['Acompanhamento geral'],
        emotionalState: analysis.emotionalState || 'Não identificado',
        suggestedFollowUp: analysis.suggestedFollowUp || ['Continuar acompanhamento'],
        preDiagnosis: analysis.preDiagnosis || 'Sem indicações específicas.',
        riskIndicators: analysis.riskIndicators || null,
        therapeuticNotes: analysis.therapeuticNotes || 'Sessão transcorreu normalmente.',
        source: 'ai',
      };
    } catch (err) {
      app.log.error('AI analysis error:', err);
      return performLocalAnalysis({ transcription, patientName, sessionDuration });
    }
  });
}

// ── Local fallback analysis (keyword-based) ─────────────────
function performLocalAnalysis(req: {
  transcription: string;
  patientName: string;
  sessionDuration: number;
}) {
  const words = req.transcription.toLowerCase();

  const emotionalKeywords: Record<string, string[]> = {
    ansiedade: ['ansioso', 'ansiedade', 'nervoso', 'preocupado', 'medo', 'pânico'],
    tristeza: ['triste', 'deprimido', 'desanimado', 'sem esperança', 'vazio'],
    raiva: ['raiva', 'irritado', 'frustrado', 'bravo', 'revoltado'],
    estresse: ['estresse', 'estressado', 'cansado', 'esgotado', 'sobrecarregado'],
    positivo: ['melhor', 'bem', 'feliz', 'animado', 'esperança', 'progresso'],
  };

  const detectedEmotions: string[] = [];
  for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
    if (keywords.some((kw) => words.includes(kw))) {
      detectedEmotions.push(emotion);
    }
  }

  const riskKeywords = ['suicídio', 'morrer', 'acabar com tudo', 'não aguento mais', 'sem saída'];
  const riskIndicators = riskKeywords.filter((kw) => words.includes(kw));

  const topicKeywords = [
    'trabalho', 'família', 'relacionamento', 'saúde', 'sono',
    'alimentação', 'social', 'autoestima', 'passado', 'futuro',
  ];
  const keyTopics = topicKeywords.filter((topic) => words.includes(topic));

  return {
    summary: `Sessão de ${req.sessionDuration} minutos com ${req.patientName}. ${
      keyTopics.length > 0
        ? `Principais temas: ${keyTopics.join(', ')}.`
        : 'Temas gerais de acompanhamento.'
    }`,
    keyTopics: keyTopics.length > 0 ? keyTopics : ['Acompanhamento geral'],
    emotionalState: detectedEmotions.length > 0 ? detectedEmotions.join(', ') : 'Estável',
    suggestedFollowUp: ['Continuar acompanhamento regular'],
    preDiagnosis:
      detectedEmotions.length > 0
        ? `Possíveis indicadores de ${detectedEmotions.join(' e ')}.`
        : 'Sem indicadores significativos.',
    riskIndicators: riskIndicators.length > 0 ? riskIndicators : null,
    therapeuticNotes: riskIndicators.length > 0
      ? 'ATENÇÃO: Indicadores de risco detectados.'
      : 'Sem indicadores de risco imediato.',
    source: 'local',
  };
}
