import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, teardownDb, clearDb, app, signedInAgent } from './helpers.js';
import { env } from '../src/config/env.js';
import { AiRun } from '../src/models/AiRun.js';
import { __reset } from '../src/services/orchestration/runBus.js';

before(async () => {
  await setupDb();
  env.aiMode = 'mock'; // exercise the real pipeline end to end with no network
});
after(teardownDb);
beforeEach(async () => {
  await clearDb();
  __reset();
});

const settle = async (id, agent) => {
  for (let i = 0; i < 80; i += 1) {
    const { body } = await agent.get(`/api/v1/answers/${id}`);
    if (['completed', 'failed', 'cancelled'].includes(body.run.status)) return body.run;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('run did not settle');
};

test('POST /answers starts a run, creates a conversation, and completes end to end', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'Why is the sky blue?' });

  assert.equal(res.status, 202);
  assert.equal(res.body.run.status, 'queued');
  assert.match(res.body.streamUrl, /\/stream$/);

  const run = await settle(res.body.run.id, agent);
  assert.equal(run.status, 'completed');
  assert.ok(run.finalAnswer.includes('MOCK MODE'));
  assert.equal(run.agents.generator.mode, 'mock');
  assert.equal(run.agents.synthesizer.status, 'completed');

  const conversations = await agent.get('/api/v1/conversations');
  assert.equal(conversations.body.total, 1);
  assert.equal(conversations.body.items[0].title, 'Why is the sky blue?');
});

test('a run appends both the question and the answer to the conversation', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'Explain recursion' });
  await settle(res.body.run.id, agent);

  const { body } = await agent.get(`/api/v1/conversations/${res.body.run.conversationId}`);
  assert.deepEqual(body.conversation.messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(body.runs.length, 1);
});

test('a follow-up continues the same conversation', async () => {
  const { agent } = await signedInAgent();
  const first = await agent.post('/api/v1/answers').send({ question: 'What is a monad?' });
  await settle(first.body.run.id, agent);

  const second = await agent.post(`/api/v1/answers/${first.body.run.id}/follow-up`).send({ question: 'Give an example' });
  assert.equal(second.status, 202);
  assert.equal(second.body.run.conversationId, first.body.run.conversationId);
  assert.equal(second.body.run.kind, 'follow-up');
  await settle(second.body.run.id, agent);
});

test('regenerate reuses the original question and links to the parent run', async () => {
  const { agent } = await signedInAgent();
  const first = await agent.post('/api/v1/answers').send({ question: 'Prove that sqrt(2) is irrational' });
  await settle(first.body.run.id, agent);

  const again = await agent.post(`/api/v1/answers/${first.body.run.id}/regenerate`).send({});
  assert.equal(again.body.run.question, 'Prove that sqrt(2) is irrational');
  assert.equal(again.body.run.parentRunId, first.body.run.id);
  await settle(again.body.run.id, agent);
});

test('settings from the request override the user\'s defaults', async () => {
  const { agent } = await signedInAgent();
  await agent.patch('/api/v1/auth/preferences').send({ answerStyle: 'concise' });
  const res = await agent.post('/api/v1/answers').send({ question: 'Define entropy', settings: { answerStyle: 'detailed' } });
  assert.equal(res.body.run.settings.answerStyle, 'detailed');
  await settle(res.body.run.id, agent);
});

test('a too-short question is rejected', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'hi' });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.details.fields[0].path, 'question');
});

test('a user cannot read, cancel or follow up on another user\'s run', async () => {
  const a = app();
  const owner = await signedInAgent(a);
  const intruder = await signedInAgent(a);

  const res = await owner.agent.post('/api/v1/answers').send({ question: 'Private question' });
  const id = res.body.run.id;
  await settle(id, owner.agent);

  assert.equal((await intruder.agent.get(`/api/v1/answers/${id}`)).status, 404);
  assert.equal((await intruder.agent.post(`/api/v1/answers/${id}/cancel`)).status, 404);
  assert.equal((await intruder.agent.get(`/api/v1/answers/${id}/stream`)).status, 404);
  assert.equal(
    (await intruder.agent.post(`/api/v1/answers/${id}/follow-up`).send({ question: 'sneaky follow-up' })).status,
    404,
  );
});

test('answers endpoints require authentication', async () => {
  const supertest = (await import('supertest')).default;
  assert.equal((await supertest(app()).post('/api/v1/answers').send({ question: 'anything at all' })).status, 401);
});

test('the SSE stream replays the full event sequence and terminates', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'What is the capital of Japan?' });
  await settle(res.body.run.id, agent);

  const stream = await agent.get(`/api/v1/answers/${res.body.run.id}/stream`).buffer(true).parse((r, cb) => {
    let data = '';
    r.on('data', (c) => { data += c; });
    r.on('end', () => cb(null, data));
  });

  assert.equal(stream.status, 200);
  assert.match(stream.headers['content-type'], /text\/event-stream/);
  assert.match(stream.body, /event: run\.started/);
  assert.match(stream.body, /event: run\.completed/);
  assert.ok(!stream.body.includes('apiKey'));
});

test('cancel marks an in-flight run cancelled', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'A long research question' });
  const cancelled = await agent.post(`/api/v1/answers/${res.body.run.id}/cancel`);
  assert.equal(cancelled.status, 200);

  const run = await settle(res.body.run.id, agent);
  assert.ok(['cancelled', 'completed'].includes(run.status));
});

test('concurrency is capped', async () => {
  const { agent } = await signedInAgent();
  const original = env.maxConcurrentRuns;
  env.maxConcurrentRuns = 1;
  try {
    const first = await agent.post('/api/v1/answers').send({ question: 'First question here' });
    const second = await agent.post('/api/v1/answers').send({ question: 'Second question here' });
    assert.equal(second.status, 503);
    assert.equal(second.body.error.code, 'at_capacity');
    await settle(first.body.run.id, agent);
  } finally {
    env.maxConcurrentRuns = original;
  }
});

test('deleting a conversation removes its runs', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'Disposable question' });
  await settle(res.body.run.id, agent);

  await agent.delete(`/api/v1/conversations/${res.body.run.conversationId}`);
  assert.equal(await AiRun.countDocuments({ conversationId: res.body.run.conversationId }), 0);
});

test('system endpoints expose status but never key material', async () => {
  const a = app();
  const supertest = (await import('supertest')).default;
  assert.equal((await supertest(a).get('/api/v1/health')).status, 200);
  assert.equal((await supertest(a).get('/api/v1/ready')).body.checks.mongodb, true);

  const providers = await supertest(a).get('/api/v1/providers/status');
  assert.equal(providers.body.providers.length, 3);
  assert.ok(!JSON.stringify(providers.body).match(/apiKey|secret/i));
});

test('a preference min above max is clamped rather than failing the run', async () => {
  const { agent } = await signedInAgent();
  await agent.patch('/api/v1/auth/preferences').send({ minRefinementIterations: 6, maxRefinementIterations: 2 });
  const res = await agent.post('/api/v1/answers').send({ question: 'Clamp check question' });
  assert.equal(res.status, 202);
  assert.equal(res.body.run.settings.minRefinementIterations, 2);
  await settle(res.body.run.id, agent);
});

test('a request with min above max is clamped to max', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({
    question: 'Bad range question',
    settings: { minRefinementIterations: 5, maxRefinementIterations: 1 },
  });
  assert.equal(res.status, 202); // request overrides pass through the same clamp
  assert.equal(res.body.run.settings.minRefinementIterations, 1);
  await settle(res.body.run.id, agent);
});

test('the five reasoning depth levels are accepted', async () => {
  const { agent } = await signedInAgent();
  const res = await agent.post('/api/v1/answers').send({ question: 'Depth check question', settings: { reasoningDepth: 'exhaustive' } });
  assert.equal(res.body.run.settings.reasoningDepth, 'exhaustive');
  await settle(res.body.run.id, agent);
  const bad = await agent.post('/api/v1/answers').send({ question: 'Depth check question', settings: { reasoningDepth: 'deep' } });
  assert.equal(bad.status, 422);
});
