import { env } from '../../config/env.js';
import { toResponseSchema } from './responseSchema.js';

export class ProviderError extends Error {
  constructor(message, { provider, status, retryable = false, code = 'provider_error' } = {}) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

async function postJson(url, { headers, body, timeoutMs, provider, signal }) {
  const ac = new AbortController();
  const onAbort = () => ac.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => ac.abort(new ProviderError(`${provider} timed out after ${timeoutMs}ms`, { provider, retryable: true, code: 'timeout' })), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const dailyQuota = res.status === 429 && /PerDay/i.test(text);
      throw new ProviderError(`${provider} responded ${res.status}: ${text.slice(0, 300)}`, {
        provider,
        status: res.status,
        // A daily quota will not recover by retrying; only per-minute limits are worth backing off for.
        retryable: RETRYABLE_STATUS.has(res.status) && !dailyQuota,
        code: dailyQuota ? 'quota_exhausted' : res.status === 429 ? 'rate_limited' : 'provider_error',
      });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError(`${provider} returned a non-JSON envelope`, { provider, retryable: true });
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err?.name === 'AbortError') {
      if (ac.signal.reason instanceof ProviderError) throw ac.signal.reason;
      throw new ProviderError('Cancelled', { provider, code: 'cancelled' });
    }
    throw new ProviderError(`${provider} request failed: ${err.message}`, { provider, retryable: true, code: 'network' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const usageFrom = (u = {}) => ({
  promptTokens: u.prompt_tokens ?? u.promptTokenCount,
  completionTokens: u.completion_tokens ?? u.candidatesTokenCount,
  totalTokens: u.total_tokens ?? u.totalTokenCount,
});

/** Each adapter: { name, model(), available(), complete({system,prompt,maxTokens,temperature,signal}) -> {text,usage} } */
const gemini = {
  name: 'gemini',
  model: () => env.providers.gemini.model,
  available: () => Boolean(env.providers.gemini.apiKey),
  async complete(opts) {
    const models = [env.providers.gemini.model, ...env.providers.gemini.fallbackModels];
    let lastError;
    for (const model of models) {
      try {
        return { ...(await geminiCall(model, opts)), model };
      } catch (err) {
        lastError = err;
        // Out of quota or overloaded on this model: the next model has its own quota and capacity.
        if (!['rate_limited', 'quota_exhausted', 'overloaded'].includes(err.code)) throw err;
      }
    }
    throw lastError;
  },
};

async function geminiCall(model, { system, prompt, maxTokens, temperature, signal, timeoutMs, schema }) {
  let data;
  try {
    data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        headers: { 'x-goog-api-key': env.providers.gemini.apiKey },
        provider: 'gemini',
        timeoutMs,
        signal,
        body: {
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            // Thinking tokens share this cap, so the answer gets maxTokens on top of the thinking budget.
            maxOutputTokens: maxTokens + env.ai.geminiThinkingBudget,
            thinkingConfig: { thinkingBudget: env.ai.geminiThinkingBudget },
            responseMimeType: 'application/json',
            // Constrains the reply to an object with the agent's fields; JSON mode alone allows a bare string.
            ...(schema ? { responseJsonSchema: toResponseSchema(schema) } : {}),
          },
        },
      },
    );
  } catch (err) {
    if (err.status === 503) throw Object.assign(err, { code: 'overloaded' });
    throw err;
  }
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new ProviderError('gemini stopped at its output token limit', { provider: 'gemini', code: 'truncated' });
  }
  if (!text) throw new ProviderError('gemini returned an empty candidate', { provider: 'gemini', retryable: true });
  return { text, usage: usageFrom(data?.usageMetadata) };
}

/** OpenAI-compatible chat completions (Groq, and the Hugging Face router). */
function openAiCompatible({ name, baseUrl, apiKey, model, jsonMode = true }) {
  return {
    name,
    model,
    available: () => Boolean(apiKey()),
    async complete({ system, prompt, maxTokens, temperature, signal, timeoutMs }) {
      const data = await postJson(`${baseUrl}/chat/completions`, {
        headers: { authorization: `Bearer ${apiKey()}` },
        provider: name,
        timeoutMs,
        signal,
        body: {
          model: model(),
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        },
      });
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new ProviderError(`${name} stopped at its output token limit`, { provider: name, code: 'truncated' });
      }
      const text = choice?.message?.content;
      if (!text) throw new ProviderError(`${name} returned an empty choice`, { provider: name, retryable: true });
      return { text, usage: usageFrom(data?.usage) };
    },
  };
}

const groq = openAiCompatible({
  name: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKey: () => env.providers.groq.apiKey,
  model: () => env.providers.groq.model,
});

const huggingface = openAiCompatible({
  name: 'huggingface',
  baseUrl: 'https://router.huggingface.co/v1',
  apiKey: () => env.providers.huggingface.apiKey,
  model: () => env.providers.huggingface.model,
  jsonMode: false, // not every routed model honours response_format
});

/** Development stand-in. Clearly labelled; never used when a real key is configured. */
const mock = {
  name: 'mock',
  model: () => 'mock-dev',
  available: () => true,
  async complete({ mockResponse }) {
    if (!mockResponse) throw new ProviderError('mock provider used without a mock response', { provider: 'mock' });
    return { text: typeof mockResponse === 'string' ? mockResponse : JSON.stringify(mockResponse), usage: {} };
  },
};

const REGISTRY = { gemini, groq, huggingface, mock };

export function getProvider(name) {
  const adapter = REGISTRY[name];
  if (!adapter) throw new ProviderError(`Unknown provider "${name}"`, { provider: name });
  if (env.aiMode === 'mock' || !adapter.available()) return { adapter: mock, mode: 'mock', intended: name };
  return { adapter, mode: 'live', intended: name };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Provider-independent completion with timeout, bounded retries and backoff. */
export async function complete(providerName, opts = {}) {
  const { adapter, mode, intended } = getProvider(providerName);
  const timeoutMs = opts.timeoutMs ?? env.ai.timeoutMs;
  const maxRetries = opts.maxRetries ?? env.ai.maxRetries;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (opts.signal?.aborted) throw new ProviderError('Cancelled', { provider: intended, code: 'cancelled' });
    try {
      const result = await adapter.complete({
        maxTokens: env.ai.maxOutputTokens,
        temperature: 0.3,
        timeoutMs,
        ...opts,
      });
      return { ...result, provider: intended, model: result.model || adapter.model(), mode, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      if (err.code === 'cancelled' || !err.retryable || attempt === maxRetries) break;
      await sleep(Math.min(2 ** attempt * 500, 4000) + Math.random() * 250);
    }
  }
  throw lastError;
}

export function providerStatus() {
  return ['gemini', 'groq', 'huggingface'].map((name) => {
    const { mode } = getProvider(name);
    return {
      provider: name,
      model: REGISTRY[name].model(),
      configured: REGISTRY[name].available(),
      mode,
    };
  });
}
