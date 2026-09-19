import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { router } from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  const allowlist = new Set(env.frontendUrl.split(',').map((s) => s.trim()).filter(Boolean));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowlist.has(origin)) return cb(null, true);
        cb(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  if (!env.isTest) app.use(pinoHttp({ logger }));

  app.use('/api/v1', apiLimiter, router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
