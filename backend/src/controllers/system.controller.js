import { dbReady } from '../config/db.js';
import { providerStatus } from '../services/ai/providers.js';
import { evidenceStatus } from '../services/evidence/index.js';
import { env } from '../config/env.js';
import { activeCount } from '../services/orchestration/runBus.js';

export const health = (_req, res) => res.json({ status: 'ok', uptime: process.uptime() });

export const ready = (_req, res) => {
  const db = dbReady();
  res.status(db ? 200 : 503).json({ status: db ? 'ready' : 'degraded', checks: { mongodb: db } });
};

/** Configuration state only — never key material. */
export const providers = (_req, res) =>
  res.json({
    aiMode: env.aiMode,
    providers: providerStatus(),
    evidence: evidenceStatus(),
    activeRuns: activeCount(),
    maxConcurrentRuns: env.maxConcurrentRuns,
  });
