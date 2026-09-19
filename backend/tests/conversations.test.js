import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, teardownDb, clearDb, app, signedInAgent } from './helpers.js';

before(setupDb);
after(teardownDb);
beforeEach(clearDb);

test('conversation CRUD works for the owner', async () => {
  const { agent } = await signedInAgent();

  const created = await agent.post('/api/v1/conversations').send({ title: 'Thermodynamics' });
  assert.equal(created.status, 201);
  const id = created.body.conversation.id;

  const listed = await agent.get('/api/v1/conversations');
  assert.equal(listed.body.total, 1);

  const renamed = await agent.patch(`/api/v1/conversations/${id}`).send({ title: 'Entropy' });
  assert.equal(renamed.body.conversation.title, 'Entropy');

  const fetched = await agent.get(`/api/v1/conversations/${id}`);
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body.runs, []);

  assert.equal((await agent.delete(`/api/v1/conversations/${id}`)).status, 204);
  assert.equal((await agent.get(`/api/v1/conversations/${id}`)).status, 404);
});

test('a user cannot read, rename or delete another user\'s conversation', async () => {
  const a = app();
  const owner = await signedInAgent(a);
  const intruder = await signedInAgent(a);

  const { body } = await owner.agent.post('/api/v1/conversations').send({ title: 'Private' });
  const id = body.conversation.id;

  assert.equal((await intruder.agent.get(`/api/v1/conversations/${id}`)).status, 404);
  assert.equal((await intruder.agent.patch(`/api/v1/conversations/${id}`).send({ title: 'Hijacked' })).status, 404);
  assert.equal((await intruder.agent.delete(`/api/v1/conversations/${id}`)).status, 404);

  const still = await owner.agent.get(`/api/v1/conversations/${id}`);
  assert.equal(still.body.conversation.title, 'Private');
});

test('conversations require authentication', async () => {
  const res = await (await import('supertest')).default(app()).get('/api/v1/conversations');
  assert.equal(res.status, 401);
});

test('search filters by title and pagination is bounded', async () => {
  const { agent } = await signedInAgent();
  await agent.post('/api/v1/conversations').send({ title: 'Quantum tunnelling' });
  await agent.post('/api/v1/conversations').send({ title: 'Baking sourdough' });

  const hit = await agent.get('/api/v1/conversations').query({ q: 'quantum' });
  assert.equal(hit.body.total, 1);
  assert.equal(hit.body.items[0].title, 'Quantum tunnelling');

  const tooBig = await agent.get('/api/v1/conversations').query({ limit: 5000 });
  assert.equal(tooBig.status, 422);
});

test('a regex injected into search is treated as a literal', async () => {
  const { agent } = await signedInAgent();
  await agent.post('/api/v1/conversations').send({ title: 'Plain title' });
  const res = await agent.get('/api/v1/conversations').query({ q: '.*' });
  assert.equal(res.body.total, 0);
});

test('a malformed conversation id yields 400, not a crash', async () => {
  const { agent } = await signedInAgent();
  assert.equal((await agent.get('/api/v1/conversations/not-an-id')).status, 400);
});
