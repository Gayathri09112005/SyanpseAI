/**
 * Extract the JSON object from a model reply.
 * Order matters: answers routinely contain ```code``` blocks *inside* JSON strings, so a fence is only
 * unwrapped when it wraps the whole reply — never searched for anywhere in the text.
 */
export function extractJson(text) {
  if (typeof text !== 'string') throw new Error('Model returned no text');
  const trimmed = text.trim();

  // 1. The normal case: the reply is the JSON object (or a JSON-encoded string of it).
  const direct = tryParse(trimmed);
  if (isObject(direct)) return direct;
  if (typeof direct === 'string' && isObject(tryParse(direct.trim()))) return tryParse(direct.trim());

  // 2. The whole reply wrapped in a single ```json fence.
  const wrapped = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (wrapped) {
    const inner = tryParse(wrapped[1]);
    if (isObject(inner)) return inner;
  }

  // 3. Prose around the object: take the first balanced {...}.
  return firstBalancedObject(trimmed);
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function firstBalancedObject(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('Truncated or unbalanced JSON in model output');
}
