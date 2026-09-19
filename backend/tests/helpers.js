import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';

let mongod;

export async function setupDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('synapseai-test'));
}

export async function teardownDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearDb() {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
}

export const app = () => createApp();

let seq = 0;
/** Returns a supertest agent with an authenticated session cookie. */
export async function signedInAgent(a = app(), overrides = {}) {
  seq += 1;
  const creds = { name: 'Test User', email: `user${seq}@example.com`, password: 'correct-horse-battery', ...overrides };
  const agent = request.agent(a);
  const res = await agent.post('/api/v1/auth/register').send(creds);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, creds };
}
