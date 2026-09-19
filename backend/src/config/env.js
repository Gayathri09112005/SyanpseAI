import dotenv from 'dotenv';
dotenv.config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : v === 'true' || v === '1');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: num(process.env.PORT, 4000),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/synapseai',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  aiMode: process.env.AI_MODE || 'live',
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      // Tried in order when a model is out of quota or overloaded. Free-tier quotas are per model.
      fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean),
    },
    groq: { apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b' },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model: process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.1-8B-Instruct',
    },
  },

  evidence: {
    provider: process.env.EVIDENCE_PROVIDER || 'none',
    tavilyKey: process.env.TAVILY_API_KEY,
    maxResults: num(process.env.EVIDENCE_MAX_RESULTS, 5),
  },

  ai: {
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 45000),
    maxRetries: num(process.env.AI_MAX_RETRIES, 2),
    maxOutputTokens: num(process.env.AI_MAX_OUTPUT_TOKENS, 4096),
    // Gemini 2.5+ "thinking" tokens are billed against the output cap; this is added on top of it.
    geminiThinkingBudget: num(process.env.GEMINI_THINKING_BUDGET, 1024),
  },
  maxRefinementIterations: num(process.env.MAX_REFINEMENT_ITERATIONS, 8),
  maxConcurrentRuns: num(process.env.MAX_CONCURRENT_RUNS, 3),
  // Number of proxy hops in front of the API, so req.ip (rate limiting) is the real client.
  // "true" = 1. Behind the Next.js proxy on a PaaS it is 2: frontend's load balancer + API's load balancer.
  trustProxy: /^\d+$/.test(process.env.TRUST_PROXY || '') ? Number(process.env.TRUST_PROXY) : bool(process.env.TRUST_PROXY, false) ? 1 : false,
};

if (env.isProd) {
  if (env.jwtSecret === 'dev-only-insecure-secret' || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 chars in production');
  }
}
