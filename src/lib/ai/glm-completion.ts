const GLM_ENDPOINTS = [
  'https://api.z.ai/api/paas/v4/chat/completions',
  'https://open.bigmodel.cn/api/paas/v4/chat/completions',
];

export async function generateGLMCompletion(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const GLM_API_KEY = process.env.GLM_API_KEY;
  if (!GLM_API_KEY) {
    return '';
  }

  const temperature = opts.temperature ?? 0.5;
  const maxTokens = opts.maxTokens ?? 600;

  let lastError: unknown;

  for (const endpoint of GLM_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GLM_MODEL || 'glm-4.5-flash',
          stream: false,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
    }
  }

  console.error('[GLM completion] all endpoints failed:', lastError);
  return '';
}
