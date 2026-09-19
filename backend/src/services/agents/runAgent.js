import { complete, ProviderError } from '../ai/providers.js';
import { env } from '../../config/env.js';
import { extractJson } from '../ai/jsonParse.js';
import { logger } from '../../config/logger.js';

const SHAPE_RULES =
  'Respond with a single JSON object and nothing else. No markdown fences, no commentary. ' +
  'Do not reveal internal chain-of-thought; give conclusions and short justifications only.';

/**
 * Runs one agent: prompt -> provider -> JSON -> zod. One repair round-trip on a
 * malformed payload, then it fails honestly rather than inventing a result.
 */
export async function runAgent({ name, provider, system, prompt, schema, mock, signal, deps = {} }) {
  const call = deps.complete || complete;
  const startedAt = new Date();
  const mockResponse = mock ? JSON.stringify(mock()) : undefined;
  const fullSystem = `${system}\n\n${SHAPE_RULES}`;

  let res;
  try {
    res = await call(provider, { system: fullSystem, prompt, signal, mockResponse, schema });
  } catch (err) {
    if (err?.code !== 'truncated') throw err;
    // Cut off mid-answer: asking it to "fix the JSON" would be cut off the same way. Give it room instead.
    logger.warn({ agent: name }, 'agent output hit the token limit, retrying with a larger budget');
    res = await call(provider, { system: fullSystem, prompt, signal, mockResponse, schema, maxTokens: Math.min(env.ai.maxOutputTokens * 2, 16384) });
  }
  let parsed = validate(schema, res.text);

  if (!parsed.success) {
    logger.warn({ agent: name, model: res.model, issue: parsed.error, raw: String(res.text).slice(0, 500) }, 'agent output failed validation, attempting repair');
    res = await call(provider, {
      system: fullSystem,
      prompt: `${prompt}\n\nYour previous reply was rejected: ${parsed.error}\nReturn a corrected JSON object matching the required shape exactly.`,
      signal,
      mockResponse,
      schema,
    });
    parsed = validate(schema, res.text);
    if (!parsed.success) {
      logger.error({ agent: name, model: res.model, issue: parsed.error, raw: String(res.text).slice(0, 500) }, 'agent output failed validation after repair');
      throw new ProviderError(`${name} produced output that does not match its schema: ${parsed.error}`, {
        provider: res.provider,
        code: 'invalid_output',
      });
    }
  }

  const completedAt = new Date();
  return {
    status: 'completed',
    provider: res.provider,
    model: res.model,
    mode: res.mode,
    output: parsed.data,
    usage: res.usage,
    startedAt,
    completedAt,
    durationMs: completedAt - startedAt,
  };
}

function validate(schema, text) {
  let raw;
  try {
    raw = extractJson(text);
  } catch (err) {
    return { success: false, error: err.message };
  }
  const result = schema.safeParse(raw);
  if (result.success) return result;
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ').slice(0, 600),
  };
}
