import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

await connectDb();
const server = app.listen(env.port, () => logger.info(`SynapseAI API listening on :${env.port}`));
server.headersTimeout = 120000;
server.requestTimeout = 0; // SSE connections are long-lived

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
