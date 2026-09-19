import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.apiKey', '*.password', '*.passwordHash'],
    remove: true,
  },
  transport: env.isProd ? undefined : { target: 'pino/file', options: { destination: 1 } },
});
