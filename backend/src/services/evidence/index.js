import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Pluggable evidence retrieval. A provider returns [{title,url,snippet}] or throws.
 * Retrieval failure is never fatal: the pipeline continues with zero sources and
 * every claim stays "unverified" rather than being fabricated.
 */
const providers = {
  none: async () => [],

  tavily: async (query, { signal, maxResults }) => {
    if (!env.evidence.tavilyKey) throw new Error('EVIDENCE_PROVIDER=tavily but TAVILY_API_KEY is not set');
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.evidence.tavilyKey}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
      signal,
    });
    if (!res.ok) throw new Error(`tavily responded ${res.status}`);
    const data = await res.json();
    return (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  },
};

export function registerEvidenceProvider(name, fn) {
  providers[name] = fn;
}

export async function retrieveEvidence(query, { signal, provider = env.evidence.provider } = {}) {
  const fn = providers[provider];
  if (!fn) {
    logger.warn({ provider }, 'unknown evidence provider; continuing without evidence');
    return { sources: [], provider, error: `Unknown evidence provider "${provider}"` };
  }
  try {
    const raw = await fn(query, { signal, maxResults: env.evidence.maxResults });
    const sources = raw
      .filter((s) => s && typeof s.url === 'string' && /^https?:\/\//.test(s.url))
      .slice(0, env.evidence.maxResults)
      .map((s) => ({
        title: String(s.title || s.url).slice(0, 300),
        url: s.url,
        snippet: String(s.snippet || '').slice(0, 1500),
        provider,
        retrievedAt: new Date(),
      }));
    return { sources, provider };
  } catch (err) {
    logger.warn({ err: err.message, provider }, 'evidence retrieval failed');
    return { sources: [], provider, error: err.message };
  }
}

export const evidenceStatus = () => ({
  provider: env.evidence.provider,
  configured: env.evidence.provider === 'none' || Boolean(env.evidence.tavilyKey),
});
