import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from '../src/services/ai/jsonParse.js';
import { complete, getProvider, providerStatus, ProviderError } from '../src/services/ai/providers.js';
import { env } from '../src/config/env.js';
import { retrieveEvidence, registerEvidenceProvider } from '../src/services/evidence/index.js';

const realFetch = globalThis.fetch;
let originalKeys;

beforeEach(() => {
  originalKeys = JSON.parse(JSON.stringify(env.providers));
  env.aiMode = 'live';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(env.providers, originalKeys);
});

test('extractJson handles fences, prose and braces inside strings', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a":{"b":2}}\n```\nhope that helps'), { a: { b: 2 } });
  assert.deepEqual(extractJson('{"a":"a } brace"}'), { a: 'a } brace' });
  assert.throws(() => extractJson('no json here'), /No JSON object/);
  assert.throws(() => extractJson('{"a": 1'), /Truncated|unbalanced/);
});

test('a provider with no key silently falls back to the labelled mock adapter', () => {
  env.providers.groq.apiKey = '';
  const { adapter, mode } = getProvider('groq');
  assert.equal(mode, 'mock');
  assert.equal(adapter.name, 'mock');
});

test('providerStatus reports configuration without leaking keys', () => {
  env.providers.gemini.apiKey = 'sk-super-secret';
  const status = providerStatus();
  assert.ok(!JSON.stringify(status).includes('sk-super-secret'));
  assert.equal(status.find((p) => p.provider === 'gemini').configured, true);
});

test('a 429 is retried with backoff and eventually succeeds', async () => {
  env.providers.groq.apiKey = 'k';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) return new Response('rate limited', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { total_tokens: 5 } }), { status: 200 });
  };
  const res = await complete('groq', { prompt: 'hi', maxRetries: 3 });
  assert.equal(calls, 3);
  assert.equal(res.text, '{"ok":true}');
  assert.equal(res.usage.totalTokens, 5);
});

test('a 400 is not retried', async () => {
  env.providers.groq.apiKey = 'k';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('bad request', { status: 400 });
  };
  await assert.rejects(() => complete('groq', { prompt: 'hi', maxRetries: 3 }), ProviderError);
  assert.equal(calls, 1);
});

test('a timeout aborts the request and is reported as retryable', async () => {
  env.providers.gemini.apiKey = 'k';
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const err = await complete('gemini', { prompt: 'hi', timeoutMs: 40, maxRetries: 0 }).catch((e) => e);
  assert.equal(err.code, 'timeout');
  assert.equal(err.retryable, true);
});

test('an external abort signal cancels immediately without retrying', async () => {
  env.providers.groq.apiKey = 'k';
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (_url, { signal }) => {
    calls += 1;
    return new Promise((_r, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  };
  const promise = complete('groq', { prompt: 'hi', signal: controller.signal, maxRetries: 3 });
  setTimeout(() => controller.abort(), 20);
  const err = await promise.catch((e) => e);
  assert.equal(err.code, 'cancelled');
  assert.equal(calls, 1);
});

test('evidence retrieval defaults to nothing and never invents sources', async () => {
  const { sources } = await retrieveEvidence('anything', { provider: 'none' });
  assert.deepEqual(sources, []);
});

test('a failing evidence provider degrades instead of throwing', async () => {
  registerEvidenceProvider('broken', async () => {
    throw new Error('upstream exploded');
  });
  const result = await retrieveEvidence('q', { provider: 'broken' });
  assert.deepEqual(result.sources, []);
  assert.match(result.error, /upstream exploded/);
});

test('evidence results with non-http urls are dropped', async () => {
  registerEvidenceProvider('sketchy', async () => [
    { title: 'ok', url: 'https://example.com/a', snippet: 's' },
    { title: 'bad', url: 'javascript:alert(1)', snippet: 's' },
    { title: 'none', snippet: 's' },
  ]);
  const { sources } = await retrieveEvidence('q', { provider: 'sketchy' });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, 'https://example.com/a');
});

test('gemini reserves a separate thinking budget and reports MAX_TOKENS as truncation', async () => {
  env.providers.gemini.apiKey = 'k';
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"answer":"cut' }] } }] }), { status: 200 });
  };
  const err = await complete('gemini', { prompt: 'hi', maxTokens: 1000, maxRetries: 0 }).catch((e) => e);
  assert.equal(err.code, 'truncated');
  assert.equal(sent.generationConfig.thinkingConfig.thinkingBudget, env.ai.geminiThinkingBudget);
  assert.equal(sent.generationConfig.maxOutputTokens, 1000 + env.ai.geminiThinkingBudget);
});

test('gemini thought parts are excluded from the answer text', async () => {
  env.providers.gemini.apiKey = 'k';
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'secret reasoning' }, { text: '{"ok":true}' }] } }] }), { status: 200 });
  const res = await complete('gemini', { prompt: 'hi', maxRetries: 0 });
  assert.equal(res.text, '{"ok":true}');
});

test('openai-compatible finish_reason=length is reported as truncation', async () => {
  env.providers.groq.apiKey = 'k';
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"summary":"cu' } }] }), { status: 200 });
  const err = await complete('groq', { prompt: 'hi', maxRetries: 0 }).catch((e) => e);
  assert.equal(err.code, 'truncated');
});

test('gemini falls back to the next model when one is out of daily quota, and reports which answered', async () => {
  env.providers.gemini.apiKey = 'k';
  env.providers.gemini.model = 'primary';
  env.providers.gemini.fallbackModels = ['backup'];
  const tried = [];
  globalThis.fetch = async (url) => {
    tried.push(url.includes('primary') ? 'primary' : 'backup');
    if (url.includes('primary')) {
      return new Response(JSON.stringify({ error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }), { status: 429 });
    }
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
  };
  const res = await complete('gemini', { prompt: 'hi', maxRetries: 0 });
  assert.deepEqual(tried, ['primary', 'backup']);
  assert.equal(res.model, 'backup');
});

test('when every gemini model is out of daily quota the error says so and is not retried', async () => {
  env.providers.gemini.apiKey = 'k';
  env.providers.gemini.model = 'primary';
  env.providers.gemini.fallbackModels = ['backup'];
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}', { status: 429 });
  };
  const err = await complete('gemini', { prompt: 'hi', maxRetries: 3 }).catch((e) => e);
  assert.equal(err.code, 'quota_exhausted');
  assert.equal(calls, 2); // one per model, no backoff retries on a daily quota
});

test('gemini requests carry a JSON schema requiring an object with the agent fields', async () => {
  const { synthesisSchema } = await import('../src/validators/agentSchemas.js');
  env.providers.gemini.apiKey = 'k';
  env.providers.gemini.model = 'm';
  env.providers.gemini.fallbackModels = [];
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"finalAnswer":"x"}' }] } }] }), { status: 200 });
  };
  await complete('gemini', { prompt: 'hi', maxRetries: 0, schema: synthesisSchema });
  const js = sent.generationConfig.responseJsonSchema;
  assert.equal(js.type, 'object');
  assert.deepEqual(js.required, ['finalAnswer']);
  assert.equal(js.properties.keyCorrections.type, 'array');
});

test('the "auto" domain is never shown to a model as the word "auto"', async () => {
  const { contextBlock } = await import('../src/services/agents/prompts.js');
  const text = contextBlock({ answerStyle: 'balanced', domain: 'auto', reasoningDepth: 'standard' });
  assert.doesNotMatch(text, /Domain: auto\b/);
});

test('extractJson keeps the JSON object when the answer itself contains code fences', () => {
  const reply = JSON.stringify({ finalAnswer: 'Code:\n\n```python\ndef f():\n    return {"a": 1}\n```\n\nDone.', keyCorrections: [] }, null, 2);
  assert.equal(extractJson(reply).finalAnswer.startsWith('Code:'), true);
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson(JSON.stringify(JSON.stringify({ a: 2 }))), { a: 2 });
  assert.deepEqual(extractJson('Sure! {"a":3} hope this helps'), { a: 3 });
});

test('a daily-quota 429 is classified from the full body even when the marker is far into it', async () => {
  env.providers.groq.apiKey = 'k';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: 'x'.repeat(600), details: [{ quotaId: 'RequestsPerDayPerProject' }] } }), { status: 429 });
  };
  const err = await complete('groq', { prompt: 'hi', maxRetries: 3 }).catch((e) => e);
  assert.equal(err.code, 'quota_exhausted');
  assert.equal(calls, 1);
});
