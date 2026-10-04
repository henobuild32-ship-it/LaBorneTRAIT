import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { generateGLMCompletion } from '@/lib/ai/glm-completion';

export const runtime = 'nodejs';

// POST /api/ai/translate – traduit un message via GLM
export async function POST(request: NextRequest) {
  try {
    authenticateRequest(request);
    const { text, targetLang } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'text requis' }, { status: 400 });
    }

    const lang = targetLang || 'fr';
    const system = `Tu es un traducteur professionnel. Traduis le texte fourni en ${lang === 'en' ? 'anglais' : lang === 'lingala' ? 'lingala' : lang === 'swahili' ? 'swahili' : 'français'}. Ne réponds QUE par la traduction, sans commentaire ni guillemets.`;
    const translation = await generateGLMCompletion(system, text, { temperature: 0.2, maxTokens: 1500 });

    if (!translation) {
      return NextResponse.json({ error: 'Traduction indisponible' }, { status: 502 });
    }

    return NextResponse.json({ translation });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Translate] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
