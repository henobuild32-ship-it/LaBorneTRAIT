interface GLMInput {
  message: string;
  schoolContext: string;
  userName: string;
  userRole: string;
  historyMessages: { role: string; content: string }[];
  systemPrompt: string;
}

export async function generateGLMResponse(input: GLMInput): Promise<Response> {
  const GLM_API_KEY = process.env.GLM_API_KEY;
  if (!GLM_API_KEY) {
    throw new Error('GLM_API_KEY n\'est pas configurée. Ajoutez-la dans vos variables d\'environnement.');
  }
  const MODEL = process.env.GLM_MODEL || 'glm-4.5-flash';

  const messages = [
    { role: 'system', content: input.systemPrompt },
    ...input.historyMessages,
    { role: 'user', content: input.message },
  ];

  // Nous essayons d'abord l'endpoint global api.z.ai. S'il échoue, nous basculons sur l'endpoint open.bigmodel.cn.
  const endpoints = [
    'https://api.z.ai/api/paas/v4/chat/completions',
    'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  ];

  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      console.log(`[GLM] Tentative d'appel à l'API GLM via : ${endpoint}`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          temperature: 0.7,
          max_tokens: 1200,
          messages,
        }),
      });

      if (res.ok) {
        console.log(`[GLM] Connexion réussie avec l'endpoint : ${endpoint}`);
        return res;
      }

      const errText = await res.text().catch(() => '');
      console.warn(`[GLM] Erreur endpoint ${endpoint} (Status ${res.status}) : ${errText.slice(0, 150)}`);
      lastError = new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
    } catch (err) {
      console.error(`[GLM] Échec de la requête sur ${endpoint} :`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Impossible de joindre l'API GLM.");
}
