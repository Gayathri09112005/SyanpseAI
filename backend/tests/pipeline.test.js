import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupDb, teardownDb, clearDb } from './helpers.js';
import { AiRun } from '../src/models/AiRun.js';
import { Conversation } from '../src/models/Conversation.js';
import { User } from '../src/models/User.js';
import { executeRun } from '../src/services/orchestration/pipeline.js';
import { openRun, publish, subscribe, __reset } from '../src/services/orchestration/runBus.js';
import { ProviderError } from '../src/services/ai/providers.js';

before(setupDb);
after(teardownDb);
beforeEach(async () => {
  await clearDb();
  __reset();
});

const OUTPUTS = {
  gemini: {
    answer: 'Water boils at 100 °C at one atmosphere.',
    keyClaims: ['Water boils at 100 °C at 1 atm'],
    assumptions: ['Standard atmospheric pressure'],
    uncertainties: [],
  },
  groq: {
    overallAssessment: 'minor_issues',
    claims: [{ claim: 'Water boils at 100 °C at 1 atm', status: 'unverified', explanation: 'No evidence retrieved', evidenceIds: [] }],
    issues: [{ severity: 'low', description: 'Pressure dependence is not stated', suggestedFix: 'Mention altitude' }],
    missingInformation: [],
    summary: 'Broadly correct.',
  },
  huggingface: {
    summary: 'Logic is sound.',
    logicalIssues: [],
    missingSteps: ['Does not explain why pressure matters'],
    assumptions: [],
    edgeCases: [],
    suggestedImprovements: [],
  },
};

const SYNTH = {
  finalAnswer: 'At one atmosphere water boils at 100 °C; the boiling point falls with altitude.',
  keyCorrections: ['Stated the pressure dependence explicitly'],
  remainingUncertainty: [],
  sourcesUsed: [],
};

/** Fake provider layer: returns canned JSON keyed by provider, with a call log. */
function fakeComplete(overrides = {}) {
  const calls = [];
  const fn = async (provider, opts) => {
    calls.push({ provider, opts });
    const behaviour = overrides[provider];
    if (typeof behaviour === 'function') return behaviour({ provider, opts, calls });
    const isSynthesis = provider === 'gemini' && opts.system.includes('You are the Synthesizer');
    const isRefine = provider === 'gemini' && opts.system.includes('You are the Refiner');
    const body = isSynthesis ? SYNTH : isRefine ? OUTPUTS.gemini : OUTPUTS[provider];
    return { text: JSON.stringify(body), provider, model: `${provider}-test`, mode: 'live', usage: { totalTokens: 10 } };
  };
  fn.calls = calls;
  return fn;
}

async function seedRun(settings = {}) {
  const user = await User.create({ name: 'T', email: `t${Date.now()}@e.com`, passwordHash: 'x' });
  const conversation = await Conversation.create({ userId: user._id, title: 'c' });
  return AiRun.create({
    userId: user._id,
    conversationId: conversation._id,
    question: 'At what temperature does water boil?',
    settings: { maxRefinementIterations: 0, ...settings },
  });
}

async function run(run, deps, { signal } = {}) {
  const controller = new AbortController();
  openRun(run.id, controller);
  const events = [];
  subscribe(run.id, 0, (e) => events.push(e));
  await executeRun(run, { history: [], deps, signal: signal || controller.signal });
  return { events, controller, fresh: await AiRun.findById(run.id) };
}

test('a full run produces a final answer and emits the whole event sequence', async () => {
  const complete = fakeComplete();
  const { events, fresh } = await run(await seedRun(), { complete });

  assert.equal(fresh.status, 'completed');
  assert.equal(fresh.finalAnswer, SYNTH.finalAnswer);
  assert.deepEqual(fresh.keyCorrections, SYNTH.keyCorrections);
  assert.equal(fresh.agents.verifier.status, 'completed');
  assert.ok(fresh.durationMs >= 0);

  const types = events.map((e) => e.type);
  assert.deepEqual(types.filter((t) => t.startsWith('run.')), ['run.started', 'run.completed']);
  assert.equal(types.filter((t) => t === 'agent.completed').length, 4);

  // The assistant message is appended to the conversation.
  const conversation = await Conversation.findById(fresh.conversationId);
  assert.equal(conversation.messages.at(-1).content, SYNTH.finalAnswer);
});

test('the verifier and reasoner both run after generation, and in parallel', async () => {
  const complete = fakeComplete();
  await run(await seedRun(), { complete });
  const order = complete.calls.map((c) => c.provider);
  assert.equal(order[0], 'gemini');
  assert.deepEqual(new Set(order.slice(1, 3)), new Set(['groq', 'huggingface']));
});

test('the generator never sees another agent\'s output', async () => {
  const complete = fakeComplete();
  await run(await seedRun(), { complete });
  const generatorPrompt = complete.calls[0].opts.prompt;
  assert.ok(!generatorPrompt.includes('Verifier'));
  assert.ok(!generatorPrompt.includes(OUTPUTS.groq.summary));
});

test('a verifier failure degrades the run instead of fabricating findings', async () => {
  const complete = fakeComplete({
    groq: async () => {
      throw new ProviderError('groq responded 500', { provider: 'groq', retryable: true });
    },
  });
  const { events, fresh } = await run(await seedRun(), { complete });

  assert.equal(fresh.status, 'completed');
  assert.equal(fresh.agents.verifier.status, 'failed');
  assert.equal(fresh.agents.verifier.output, undefined);
  assert.equal(fresh.degraded, true);
  assert.ok(fresh.remainingUncertainty.some((u) => u.includes('Verifier did not complete')));
  assert.ok(events.some((e) => e.type === 'agent.failed' && e.data.agent === 'verifier'));
});

test('a generator failure fails the whole run with a safe message', async () => {
  const complete = fakeComplete({
    gemini: async () => {
      throw new ProviderError('gemini responded 401: {"key":"sk-secret-leak"}', { provider: 'gemini' });
    },
  });
  const { events, fresh } = await run(await seedRun(), { complete });

  assert.equal(fresh.status, 'failed');
  assert.equal(fresh.finalAnswer, undefined);
  const failed = events.find((e) => e.type === 'run.failed');
  assert.ok(!JSON.stringify(failed).includes('sk-secret-leak'));
});

test('malformed agent JSON triggers one repair attempt, then fails honestly', async () => {
  let attempts = 0;
  const complete = fakeComplete({
    groq: async () => {
      attempts += 1;
      return { text: 'I am not JSON at all', provider: 'groq', model: 'm', mode: 'live', usage: {} };
    },
  });
  const { fresh } = await run(await seedRun(), { complete });
  assert.equal(attempts, 2);
  assert.equal(fresh.agents.verifier.status, 'failed');
  assert.equal(fresh.agents.verifier.error.code, 'invalid_output');
});

test('a repaired second attempt is accepted', async () => {
  let attempts = 0;
  const complete = fakeComplete({
    groq: async () => {
      attempts += 1;
      const text = attempts === 1 ? '{"nope": true}' : JSON.stringify(OUTPUTS.groq);
      return { text, provider: 'groq', model: 'm', mode: 'live', usage: {} };
    },
  });
  const { fresh } = await run(await seedRun(), { complete });
  assert.equal(attempts, 2);
  assert.equal(fresh.agents.verifier.status, 'completed');
});

test('refinement runs at most maxRefinementIterations times and is recorded', async () => {
  const complete = fakeComplete();
  const { fresh } = await run(await seedRun({ maxRefinementIterations: 1 }), { complete });
  assert.equal(fresh.refinementHistory.length, 1);
  assert.equal(complete.calls.filter((c) => c.opts.system.includes('You are the Refiner')).length, 1);
});

test('refinement is skipped when neither reviewer raised anything', async () => {
  const complete = fakeComplete({
    groq: async () => ({
      text: JSON.stringify({ overallAssessment: 'sound', claims: [], issues: [], missingInformation: [], summary: 'ok' }),
      provider: 'groq', model: 'm', mode: 'live', usage: {},
    }),
    huggingface: async () => ({
      text: JSON.stringify({ summary: 'ok', logicalIssues: [], missingSteps: [], assumptions: [], edgeCases: [], suggestedImprovements: [] }),
      provider: 'huggingface', model: 'm', mode: 'live', usage: {},
    }),
  });
  const { fresh } = await run(await seedRun({ maxRefinementIterations: 3 }), { complete });
  assert.equal(fresh.refinementHistory.length, 0);
});

test('cancelling mid-run stops the pipeline and marks the run cancelled', async () => {
  const controller = new AbortController();
  const complete = fakeComplete({
    gemini: async ({ opts }) => {
      if (!opts.system.includes('Synthesizer')) controller.abort();
      return { text: JSON.stringify(OUTPUTS.gemini), provider: 'gemini', model: 'm', mode: 'live', usage: {} };
    },
  });
  const seeded = await seedRun();
  const { events, fresh } = await run(seeded, { complete }, { signal: controller.signal });

  assert.equal(fresh.status, 'cancelled');
  assert.ok(events.some((e) => e.type === 'run.cancelled'));
  assert.equal(complete.calls.filter((c) => c.opts.system.includes('Synthesizer')).length, 0);
});

test('evidence retrieval failure leaves claims unverified rather than fabricating sources', async () => {
  const complete = fakeComplete();
  const seeded = await seedRun({ evidenceRetrieval: true });
  const { fresh } = await run(seeded, { complete });
  assert.deepEqual(fresh.sources, []);
  assert.ok(fresh.remainingUncertainty.some((u) => /evidence/i.test(u)));
});

test('the run bus replays buffered events to a late subscriber', async () => {
  const id = new mongoose.Types.ObjectId();
  openRun(id, new AbortController());
  publish(id, 'run.started', { a: 1 });
  publish(id, 'agent.started', { b: 2 });

  const seen = [];
  subscribe(id, 0, (e) => seen.push(e.type));
  assert.deepEqual(seen, ['run.started', 'agent.started']);

  const afterFirst = [];
  subscribe(id, 1, (e) => afterFirst.push(e.type));
  assert.deepEqual(afterFirst, ['agent.started']);
});

test('minRefinementIterations forces passes even when reviewers raised nothing', async () => {
  const clean = {
    groq: async () => ({
      text: JSON.stringify({ overallAssessment: 'sound', claims: [], issues: [], missingInformation: [], summary: 'ok' }),
      provider: 'groq', model: 'm', mode: 'live', usage: {},
    }),
    huggingface: async () => ({
      text: JSON.stringify({ summary: 'ok', logicalIssues: [], missingSteps: [], assumptions: [], edgeCases: [], suggestedImprovements: [] }),
      provider: 'huggingface', model: 'm', mode: 'live', usage: {},
    }),
  };
  const { fresh } = await run(await seedRun({ minRefinementIterations: 2, maxRefinementIterations: 5 }), { complete: fakeComplete(clean) });
  assert.equal(fresh.refinementHistory.length, 2);
});

test('with transcripts off, the answer is kept and agent outputs are discarded', async () => {
  const { fresh } = await run(await seedRun({ storeAgentTranscripts: false, maxRefinementIterations: 1 }), { complete: fakeComplete() });
  assert.equal(fresh.finalAnswer, SYNTH.finalAnswer);
  assert.equal(fresh.agents.generator.output, undefined);
  assert.equal(fresh.agents.verifier.output, undefined);
  assert.equal(fresh.agents.verifier.status, 'completed');
  assert.deepEqual(fresh.refinementHistory, []);
});

test('the conversation gets a history status line', async () => {
  const { fresh } = await run(await seedRun(), { complete: fakeComplete() });
  const conversation = await Conversation.findById(fresh.conversationId);
  assert.equal(conversation.lastRun.note, '1 unverified claim');

  const failing = fakeComplete({
    groq: async () => { throw new ProviderError('down', { provider: 'groq' }); },
  });
  const second = await run(await seedRun(), { complete: failing });
  assert.equal((await Conversation.findById(second.fresh.conversationId)).lastRun.note, 'verifier failed');
});

test('a truncated agent reply is retried once with a larger token budget', async () => {
  const budgets = [];
  const complete = fakeComplete({
    groq: async ({ opts }) => {
      budgets.push(opts.maxTokens);
      if (budgets.length === 1) throw new ProviderError('cut off', { provider: 'groq', code: 'truncated' });
      return { text: JSON.stringify(OUTPUTS.groq), provider: 'groq', model: 'm', mode: 'live', usage: {} };
    },
  });
  const { fresh } = await run(await seedRun(), { complete });
  assert.equal(fresh.agents.verifier.status, 'completed');
  assert.equal(budgets[0], undefined);
  assert.ok(budgets[1] > 4000);
});
