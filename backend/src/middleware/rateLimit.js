import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, max, code) =>
  rateLimit({
    windowMs,
    max: env.isTest ? 100000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: { code, message: 'Too many requests. Please slow down.' } }),
  });

export const apiLimiter = make(60_000, 120, 'rate_limited');
export const authLimiter = make(15 * 60_000, 20, 'auth_rate_limited');
export const runLimiter = make(60_000, 10, 'run_rate_limited');
