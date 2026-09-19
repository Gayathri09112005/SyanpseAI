/* eslint-disable no-console -- manual mode reports model timings to the person running it */
/**
 * Manual integration mode — calls the REAL provider APIs through the real agents
 * (their actual prompts, schema validation and repair pass). Costs a few cents at most.
 *   cd backend && npm run test:integration
 * Each agent is skipped when its provider has no key configured.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from '../../src/services/ai/providers.js';
import { generatorAgent } from '../../src/services/agents/generator.js';
import { verifierAgent } from '../../src/services/agents/verifier.js';
import { reasonerAgent } from '../../src/services/agents/reasoner.js';
import { refinerAgent } from '../../src/services/agents/refiner.js';
import { synthesizerAgent } from '../../src/services/agents/synthesizer.js';

const settings = { answerStyle: 'concise', reasoningDepth: 'fast', domain: 'general', evidenceRetrieval: false };
const question = 'At sea level, at what temperature does pure water boil, in Celsius?';
const draft = {
  answer: 'Pure water boils at 100 °C at sea level (1 atm).',
  keyClaims: ['Pure water boils at 100 °C at 1 atm'],
  assumptions: ['Standard atmospheric pressure'],
  uncertainties: [],
};

const skip = (name) => getProvider(name).mode === 'mock' && `${name} has no API key configured`;

const check = (result) => {
  assert.equal(result.mode, 'live', 'ran against the real provider');
  assert.equal(result.status, 'completed');
  console.log(`  ${result.provider} · ${result.model} · ${result.durationMs}ms`);
};

test('Answer Generator (Gemini) produces a schema-valid draft', { skip: skip('gemini'), timeout: 120_000 }, async () => {
  const result = await generatorAgent({ question, settings, history: [] });
  check(result);
  assert.ok(result.output.answer.length > 0);
});

test('Verifier (Groq) produces schema-valid findings', { skip: skip('groq'), timeout: 120_000 }, async () => {
  const result = await verifierAgent({ question, settings, draft, sources: [] });
  check(result);
  assert.ok(result.output.summary.length > 0);
  // With no evidence retrieved, nothing may be marked as evidence-backed.
  assert.ok(result.output.claims.every((c) => !['supported_by_evidence', 'contradicted_by_evidence'].includes(c.status)));
});

test('Reasoning Agent (Hugging Face) produces a schema-valid critique', { skip: skip('huggingface'), timeout: 120_000 }, async () => {
  const result = await reasonerAgent({ question, settings, draft });
  check(result);
  assert.ok(result.output.summary.length > 0);
});

// The run that exposed token truncation: a balanced-length answer on a real topic, end to end.
test('Full pipeline agents handle a realistic-length answer without truncation', { skip: skip('gemini') || skip('groq') || skip('huggingface'), timeout: 300_000 }, async () => {
  const s = { ...settings, answerStyle: 'balanced', reasoningDepth: 'standard', domain: 'auto' };
  const q = 'What is machine learning, and how does supervised learning differ from unsupervised learning?';
  const gen = await generatorAgent({ question: q, settings: s, history: [] });
  check(gen);
  const [ver, rea] = await Promise.all([
    verifierAgent({ question: q, settings: s, draft: gen.output, sources: [] }),
    reasonerAgent({ question: q, settings: s, draft: gen.output }),
  ]);
  check(ver);
  check(rea);
  const ref = await refinerAgent({ question: q, settings: s, draft: gen.output, verification: ver.output, reasoning: rea.output, sources: [] });
  check(ref);
  const syn = await synthesizerAgent({ question: q, settings: s, draft: ref.output, verification: ver.output, reasoning: rea.output, sources: [] });
  check(syn);
  assert.ok(syn.output.finalAnswer.length > 200, 'final answer is substantive');
  console.log(`  final answer: ${syn.output.finalAnswer.length} chars, ${syn.output.keyCorrections.length} corrections`);
});
