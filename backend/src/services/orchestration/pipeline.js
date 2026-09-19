import { AiRun } from '../../models/AiRun.js';
import { Conversation } from '../../models/Conversation.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { generatorAgent } from '../agents/generator.js';
import { verifierAgent } from '../agents/verifier.js';
import { reasonerAgent } from '../agents/reasoner.js';
import { refinerAgent } from '../agents/refiner.js';
import { synthesizerAgent } from '../agents/synthesizer.js';
import { retrieveEvidence } from '../evidence/index.js';
import { openRun, publish } from './runBus.js';

const AGENT_META = {
  generator: { label: 'Answer Generator', stage: 'generate' },
  verifier: { label: 'Verifier', stage: 'verify' },
  reasoner: { label: 'Reasoning Agent', stage: 'reason' },
  synthesizer: { label: 'Synthesizer', stage: 'synthesize' },
};

const failure = (err) => ({
  status: 'failed',
  error: {
    message: err?.code === 'cancelled' ? 'Cancelled' : err?.message || 'Unknown provider error',
    code: err?.code || 'error',
    retryable: Boolean(err?.retryable),
  },
  completedAt: new Date(),
});

const sumUsage = (agents) =>
  Object.values(agents).reduce(
    (acc, a) => {
      const u = a?.usage || {};
      acc.promptTokens += u.promptTokens || 0;
      acc.completionTokens += u.completionTokens || 0;
      acc.totalTokens += u.totalTokens || 0;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );

/** Starts a run in the background and returns immediately. Progress streams over SSE. */
export function startRun(run, { history = [], deps = {} } = {}) {
  const controller = new AbortController();
  openRun(run.id, controller);
  executeRun(run, { history, deps, signal: controller.signal }).catch((err) =>
    logger.error({ err, runId: String(run.id) }, 'run crashed'),
  );
  return run;
}

export async function executeRun(run, { history, deps, signal }) {
  const runId = run.id;
  const startedAt = Date.now();
  const settings = run.settings.toObject ? run.settings.toObject() : run.settings;
  const question = run.question;
  const notes = [];
  const agents = { generator: {}, verifier: {}, reasoner: {}, synthesizer: {} };

  const save = (patch) => AiRun.updateOne({ _id: runId }, { $set: patch }).exec();
  const cancelled = () => signal.aborted;

  const agentStarted = (key) => {
    agents[key] = { ...agents[key], status: 'running', startedAt: new Date() };
    publish(runId, 'agent.started', { agent: key, ...AGENT_META[key] });
  };
  const agentDone = async (key, result) => {
    agents[key] = result;
    await save({ [`agents.${key}`]: result });
    publish(runId, 'agent.completed', {
      agent: key,
      ...AGENT_META[key],
      provider: result.provider,
      model: result.model,
      mode: result.mode,
      durationMs: result.durationMs,
      summary: summarise(key, result.output),
      output: result.output,
    });
  };
  const agentFailed = async (key, err) => {
    const result = { ...agents[key], ...failure(err) };
    agents[key] = result;
    await save({ [`agents.${key}`]: result });
    publish(runId, 'agent.failed', { agent: key, ...AGENT_META[key], error: result.error });
  };

  try {
    await save({ status: 'running' });
    publish(runId, 'run.started', { runId: String(runId), question, settings });

    // --- Evidence (optional, never fatal) ---
    let sources = [];
    if (settings.evidenceRetrieval) {
      publish(runId, 'evidence.started', {});
      const result = await retrieveEvidence(question, { signal });
      sources = result.sources;
      if (result.error) notes.push(`Evidence retrieval failed (${result.error}); claims could not be checked against sources.`);
      else if (!sources.length) notes.push('No external evidence was retrieved; factual claims remain unverified.');
      await save({ sources });
      publish(runId, 'evidence.completed', { count: sources.length, sources, error: result.error });
    }
    if (cancelled()) throw cancelError();

    // --- Stage 2: generation ---
    agentStarted('generator');
    let draft;
    try {
      const result = await generatorAgent({ question, settings, history, signal, deps });
      draft = result.output;
      await agentDone('generator', result);
    } catch (err) {
      await agentFailed('generator', err);
      throw err; // nothing downstream can run without a draft
    }
    if (cancelled()) throw cancelError();

    // --- Stages 3+4: verification and reasoning, in parallel ---
    const [verifyResult, reasonResult] = await Promise.allSettled([
      (async () => {
        agentStarted('verifier');
        return verifierAgent({ question, settings, draft, sources, signal, deps });
      })(),
      (async () => {
        agentStarted('reasoner');
        return reasonerAgent({ question, settings, draft, signal, deps });
      })(),
    ]);

    let verification = null;
    let reasoning = null;
    if (verifyResult.status === 'fulfilled') {
      verification = verifyResult.value.output;
      await agentDone('verifier', verifyResult.value);
    } else {
      await agentFailed('verifier', verifyResult.reason);
      notes.push('The Verifier did not complete, so factual claims in this answer were not independently checked.');
    }
    if (reasonResult.status === 'fulfilled') {
      reasoning = reasonResult.value.output;
      await agentDone('reasoner', reasonResult.value);
    } else {
      await agentFailed('reasoner', reasonResult.reason);
      notes.push('The Reasoning Agent did not complete, so the logic of this answer was not independently critiqued.');
    }
    if (cancelled()) throw cancelError();

    // --- Stage 5: refinement (bounded, skipped when there is nothing to act on) ---
    const refinementHistory = [];
    const maxIterations = Math.min(settings.maxRefinementIterations ?? 0, env.maxRefinementIterations);
    const minIterations = Math.min(settings.minRefinementIterations ?? 0, maxIterations);
    let current = draft;
    for (let i = 0; i < maxIterations; i += 1) {
      if (i >= minIterations && !needsRefinement(verification, reasoning)) break;
      publish(runId, 'refinement.started', { iteration: i + 1, of: maxIterations });
      try {
        const result = await refinerAgent({ question, settings, draft: current, verification, reasoning, sources, signal, deps });
        refinementHistory.push({
          iteration: i + 1,
          previousAnswer: current.answer,
          answer: result.output.answer,
          at: new Date(),
        });
        current = result.output;
        publish(runId, 'refinement.completed', { iteration: i + 1, answer: result.output.answer });
      } catch (err) {
        if (err?.code === 'cancelled') throw err;
        notes.push('Refinement did not complete; the final answer is based on the original draft plus the review findings.');
        publish(runId, 'refinement.failed', { iteration: i + 1, error: { message: err.message, code: err.code } });
        break;
      }
      if (cancelled()) throw cancelError();
    }
    await save({ refinementHistory });

    // --- Stage 6: synthesis ---
    agentStarted('synthesizer');
    let synthesis;
    try {
      const result = await synthesizerAgent({
        question, settings, draft: current, verification, reasoning, sources, notes, signal, deps,
      });
      synthesis = result.output;
      await agentDone('synthesizer', result);
    } catch (err) {
      await agentFailed('synthesizer', err);
      throw err;
    }

    const usage = sumUsage(agents);
    const patch = {
      status: 'completed',
      finalAnswer: synthesis.finalAnswer,
      keyCorrections: synthesis.keyCorrections,
      remainingUncertainty: [...synthesis.remainingUncertainty, ...notes],
      degraded: notes.length > 0,
      usage,
      durationMs: Date.now() - startedAt,
      completedAt: new Date(),
    };
    await save(patch);
    await Conversation.updateOne(
      { _id: run.conversationId },
      {
        $push: { messages: { role: 'assistant', content: synthesis.finalAnswer, runId } },
        $set: { lastMessageAt: new Date(), lastRun: { status: 'completed', note: statusNote(agents, verification) } },
      },
    ).exec();

    publish(runId, 'run.completed', {
      runId: String(runId),
      finalAnswer: synthesis.finalAnswer,
      keyCorrections: synthesis.keyCorrections,
      remainingUncertainty: patch.remainingUncertainty,
      sourcesUsed: (synthesis.sourcesUsed || []).map((i) => sources[i]).filter(Boolean),
      degraded: patch.degraded,
      usage,
      durationMs: patch.durationMs,
      refinementPasses: refinementHistory.length,
    });

    // "Retain transcripts" off: keep the answer, discard every intermediate agent output.
    if (settings.storeAgentTranscripts === false) {
      await AiRun.updateOne(
        { _id: runId },
        {
          $unset: Object.fromEntries(Object.keys(agents).map((k) => [`agents.${k}.output`, ''])),
          $set: { refinementHistory: [] },
        },
      ).exec();
    }
  } catch (err) {
    const isCancel = signal.aborted || err?.code === 'cancelled';
    const patch = {
      status: isCancel ? 'cancelled' : 'failed',
      error: { message: isCancel ? 'Run cancelled' : publicMessage(err), code: err?.code || 'error' },
      durationMs: Date.now() - startedAt,
      completedAt: new Date(),
    };
    await save(patch).catch(() => {});
    await Conversation.updateOne(
      { _id: run.conversationId },
      { $set: { lastRun: { status: patch.status, note: isCancel ? 'cancelled' : failedNote(agents) } } },
    ).exec().catch(() => {});
    publish(runId, isCancel ? 'run.cancelled' : 'run.failed', { runId: String(runId), error: patch.error });
  }
}

function cancelError() {
  const err = new Error('Cancelled');
  err.code = 'cancelled';
  return err;
}

/** Provider messages can carry URLs and payload fragments; keep them out of the client. */
function publicMessage(err) {
  if (err?.code === 'invalid_output') return 'An agent returned output that did not match the expected format.';
  if (err?.code === 'rate_limited') return 'An AI provider rate-limited this request. Try again shortly.';
  if (err?.code === 'quota_exhausted') return 'The AI provider\u2019s daily quota is used up for every configured model. Add GEMINI_FALLBACK_MODELS, use a key from another project, or enable billing.';
  if (err?.code === 'timeout') return 'An AI provider did not respond in time.';
  if (err?.code === 'truncated') return 'An agent\u2019s answer was longer than its output limit allows. Raise AI_MAX_OUTPUT_TOKENS or choose a shorter answer style.';
  return 'The reasoning pipeline failed before producing an answer.';
}

const needsRefinement = (verification, reasoning) =>
  Boolean(
    (verification &&
      (verification.overallAssessment !== 'sound' ||
        verification.issues.length ||
        verification.claims.some((c) => c.status === 'contradicted_by_evidence'))) ||
      (reasoning && (reasoning.logicalIssues.length || reasoning.missingSteps.length)),
  );

function summarise(key, output = {}) {
  if (key === 'generator') return `Drafted an answer with ${output.keyClaims?.length || 0} key claims.`;
  if (key === 'verifier') return output.summary || `Checked ${output.claims?.length || 0} claims.`;
  if (key === 'reasoner') return output.summary || `Found ${output.logicalIssues?.length || 0} logical issues.`;
  return `Applied ${output.keyCorrections?.length || 0} corrections.`;
}

const AGENT_NAMES = { generator: 'generator', verifier: 'verifier', reasoner: 'reasoner', synthesizer: 'synthesizer' };

function failedNote(agents) {
  const failed = Object.keys(agents).find((k) => agents[k]?.status === 'failed');
  return failed ? `${AGENT_NAMES[failed]} failed` : 'failed';
}

/** One-line history status, mirroring the design: "verified", "1 unverified claim", "verifier failed". */
function statusNote(agents, verification) {
  const failed = ['verifier', 'reasoner'].find((k) => agents[k]?.status === 'failed');
  if (failed) return `${AGENT_NAMES[failed]} failed`;
  const unverified = (verification?.claims || []).filter((c) => ['unverified', 'not_checked'].includes(c.status)).length;
  if (unverified) return `${unverified} unverified claim${unverified === 1 ? '' : 's'}`;
  return '3 agents · verified';
}
