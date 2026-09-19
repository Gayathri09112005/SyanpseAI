import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

export async function connectDb(uri = env.mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info('mongodb connected');
  return mongoose.connection;
}

export const dbReady = () => mongoose.connection.readyState === 1;
export async function disconnectDb() { await mongoose.disconnect(); }
