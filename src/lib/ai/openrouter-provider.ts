interface OpenRouterInput {
  message: string;
  schoolContext: string;
  userName: string;
  userRole: string;
  historyMessages: { role: string; content: string }[];
  systemPrompt: string;
}

// Chaîne de fallback : si un modèle échoue, on essaie le suivant
const MODEL_FALLBACK_CHAIN = [
  process.env.OR_MODEL || 'deepseek/deepseek-chat-v3-0324:free',
  'google/gemma-3-12b-it:free',
];

async function callOpenRouter(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'LaBorneTRAIT',
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        max_tokens: 1200,
        messages,
      }),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateOpenRouterResponse(input: OpenRouterInput): Promise<Response> {
  const apiKey = process.env.OR_API_KEY;

  if (!apiKey) {
    throw new Error('OR_API_KEY manquant dans les variables d\'environnement.');
  }

  const messages = [
    { role: 'system', content: input.systemPrompt },
    ...input.historyMessages,
    { role: 'user', content: input.message },
  ];

  // Tenter chaque modèle de la chaîne de fallback
  let lastError: unknown;
  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      console.log(`[OpenRouter] Tentative avec le modèle : ${model}`);
      const res = await callOpenRouter(messages, model, apiKey);

      if (res.ok) {
        console.log(`[OpenRouter] Succès avec : ${model}`);
        return res;
      }

      // 429 = rate limit → essayer le suivant immédiatement
      // 503 = service indisponible → essayer le suivant
      const status = res.status;
      const body = await res.text().catch(() => '');
      console.warn(`[OpenRouter] Modèle ${model} a retourné ${status}: ${body.slice(0, 200)}`);

      if (status === 401 || status === 403) {
        // Clé invalide → inutile d'essayer les autres modèles
        throw new Error(`Clé API invalide (${status}). Vérifiez OR_API_KEY.`);
      }

      lastError = new Error(`HTTP ${status}: ${body.slice(0, 200)}`);
      // Petite pause avant de tenter le suivant
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`[OpenRouter] Timeout avec le modèle : ${model}`);
        lastError = new Error(`Timeout (modèle: ${model})`);
      } else if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
        throw err; // Clé invalide, propager immédiatement
      } else {
        console.warn(`[OpenRouter] Erreur réseau avec ${model}:`, err);
        lastError = err;
      }
      // Pause avant le prochain modèle
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  throw lastError || new Error('Tous les modèles OpenRouter ont échoué.');
}