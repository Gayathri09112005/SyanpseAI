import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupDb, teardownDb, clearDb, app, signedInAgent } from './helpers.js';

before(setupDb);
after(teardownDb);
beforeEach(clearDb);

test('register creates a user and sets an httpOnly session cookie', async () => {
  const res = await request(app())
    .post('/api/v1/auth/register')
    .send({ name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery' });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'ada@example.com');
  assert.equal(res.body.user.passwordHash, undefined);
  const cookie = res.headers['set-cookie'][0];
  assert.match(cookie, /synapse_session=/);
  assert.match(cookie, /HttpOnly/);
});

test('register rejects a weak password and a bad email', async () => {
  const weak = await request(app())
    .post('/api/v1/auth/register')
    .send({ name: 'Ada', email: 'ada@example.com', password: 'short' });
  assert.equal(weak.status, 422);
  assert.equal(weak.body.error.code, 'validation_error');

  const bad = await request(app())
    .post('/api/v1/auth/register')
    .send({ name: 'Ada', email: 'not-an-email', password: 'correct-horse-battery' });
  assert.equal(bad.status, 422);
});

test('duplicate email is rejected', async () => {
  const a = app();
  const creds = { name: 'Ada', email: 'dup@example.com', password: 'correct-horse-battery' };
  await request(a).post('/api/v1/auth/register').send(creds);
  const res = await request(a).post('/api/v1/auth/register').send(creds);
  assert.equal(res.status, 409);
});

test('login succeeds with correct password and fails identically for both wrong-password and unknown-email', async () => {
  const a = app();
  const { creds } = await signedInAgent(a);

  const ok = await request(a).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
  assert.equal(ok.status, 200);

  const wrongPassword = await request(a).post('/api/v1/auth/login').send({ email: creds.email, password: 'nope-nope-nope' });
  const unknownEmail = await request(a).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongPassword.body, unknownEmail.body);
});

test('/auth/me requires a session and returns the signed-in user', async () => {
  const a = app();
  assert.equal((await request(a).get('/api/v1/auth/me')).status, 401);

  const { agent, user } = await signedInAgent(a);
  const me = await agent.get('/api/v1/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, user.id);
});

test('a forged session cookie is rejected', async () => {
  const res = await request(app()).get('/api/v1/auth/me').set('Cookie', 'synapse_session=not.a.jwt');
  assert.equal(res.status, 401);
});

test('logout clears the session', async () => {
  const { agent } = await signedInAgent();
  assert.equal((await agent.post('/api/v1/auth/logout')).status, 204);
  assert.equal((await agent.get('/api/v1/auth/me')).status, 401);
});

test('preferences can be updated and invalid values rejected', async () => {
  const { agent } = await signedInAgent();
  const ok = await agent.patch('/api/v1/auth/preferences').send({ answerStyle: 'detailed', evidenceRetrieval: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.preferences.answerStyle, 'detailed');
  assert.equal(ok.body.user.preferences.evidenceRetrieval, true);

  const bad = await agent.patch('/api/v1/auth/preferences').send({ answerStyle: 'shakespearean' });
  assert.equal(bad.status, 422);
});

test('delete account removes the user and their data', async () => {
  const { agent } = await signedInAgent();
  await agent.post('/api/v1/conversations').send({ title: 'Doomed' });
  assert.equal((await agent.delete('/api/v1/auth/account')).status, 204);
  assert.equal((await agent.get('/api/v1/auth/me')).status, 401);
});

test('"keep me signed in" off issues a browser-session cookie', async () => {
  const a = app();
  const { creds } = await signedInAgent(a);
  const kept = await request(a).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
  const session = await request(a).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password, remember: false });
  assert.match(kept.headers['set-cookie'][0], /Max-Age=/);
  assert.doesNotMatch(session.headers['set-cookie'][0], /Max-Age=|Expires=/);
});
