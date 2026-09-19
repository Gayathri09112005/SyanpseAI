import { AiRun } from '../models/AiRun.js';
import { Conversation } from '../models/Conversation.js';
import { AppError, notFound } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { runSettingsSchema } from '../validators/schemas.js';
import { startRun } from '../services/orchestration/pipeline.js';
import { activeCount, cancelRun, isActive, subscribe } from '../services/orchestration/runBus.js';

const resolveSettings = (user, overrides = {}) => {
  const p = user.preferences;
  const merged = {
    answerStyle: p.answerStyle,
    reasoningDepth: p.reasoningDepth,
    domain: p.domain,
    evidenceRetrieval: p.evidenceRetrieval,
    minRefinementIterations: p.minRefinementIterations,
    maxRefinementIterations: p.maxRefinementIterations,
    storeAgentTranscripts: p.storeAgentTranscripts,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
  };
  merged.minRefinementIterations = Math.min(merged.minRefinementIterations ?? 0, merged.maxRefinementIterations ?? 0);
  return runSettingsSchema.parse(merged);
};

async function launch({ user, conversation, question, settings, kind, parentRunId }) {
  if (activeCount() >= env.maxConcurrentRuns) {
    throw new AppError(503, 'The reasoning pipeline is at capacity. Try again in a moment.', 'at_capacity');
  }
  const history = conversation.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

  conversation.messages.push({ role: 'user', content: question });
  conversation.lastMessageAt = new Date();
  if (conversation.title === 'New conversation') conversation.title = question.slice(0, 80);
  await conversation.save();

  const run = await AiRun.create({
    userId: user._id,
    conversationId: conversation._id,
    question,
    settings,
    kind,
    parentRunId,
    status: 'queued',
  });
  startRun(run, { history });
  return run;
}

export const create = asyncHandler(async (req, res) => {
  const { question, conversationId, settings } = req.valid.body;
  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, userId: req.user._id })
    : await Conversation.create({ userId: req.user._id, title: question.slice(0, 80) });
  if (!conversation) throw notFound('Conversation');

  const run = await launch({
    user: req.user,
    conversation,
    question,
    settings: resolveSettings(req.user, settings),
    kind: 'initial',
  });
  res.status(202).json({ run: run.toJSON(), streamUrl: `/api/v1/answers/${run.id}/stream` });
});

export const get = asyncHandler(async (req, res) => {
  const run = await AiRun.findOne({ _id: req.params.id, userId: req.user._id });
  if (!run) throw notFound('Run');
  res.json({ run });
});

export const followUp = asyncHandler(async (req, res) => {
  const parent = await AiRun.findOne({ _id: req.params.id, userId: req.user._id });
  if (!parent) throw notFound('Run');
  const conversation = await Conversation.findOne({ _id: parent.conversationId, userId: req.user._id });
  if (!conversation) throw notFound('Conversation');

  const run = await launch({
    user: req.user,
    conversation,
    question: req.valid.body.question,
    settings: resolveSettings(req.user, { ...parent.settings.toObject(), ...req.valid.body.settings }),
    kind: 'follow-up',
    parentRunId: parent._id,
  });
  res.status(202).json({ run: run.toJSON(), streamUrl: `/api/v1/answers/${run.id}/stream` });
});

export const regenerate = asyncHandler(async (req, res) => {
  const parent = await AiRun.findOne({ _id: req.params.id, userId: req.user._id });
  if (!parent) throw notFound('Run');
  const conversation = await Conversation.findOne({ _id: parent.conversationId, userId: req.user._id });
  if (!conversation) throw notFound('Conversation');

  const run = await launch({
    user: req.user,
    conversation,
    question: parent.question,
    settings: resolveSettings(req.user, parent.settings.toObject()),
    kind: 'regenerate',
    parentRunId: parent._id,
  });
  res.status(202).json({ run: run.toJSON(), streamUrl: `/api/v1/answers/${run.id}/stream` });
});

export const cancel = asyncHandler(async (req, res) => {
  const run = await AiRun.findOne({ _id: req.params.id, userId: req.user._id }).select('_id status');
  if (!run) throw notFound('Run');
  const stopped = cancelRun(run._id);
  if (!stopped && ['queued', 'running'].includes(run.status)) {
    await AiRun.updateOne({ _id: run._id }, { $set: { status: 'cancelled', completedAt: new Date() } });
  }
  res.json({ cancelled: true });
});

/** SSE. Replays buffered events from Last-Event-ID, so a reconnect loses nothing. */
export const stream = asyncHandler(async (req, res) => {
  const run = await AiRun.findOne({ _id: req.params.id, userId: req.user._id });
  if (!run) throw notFound('Run');

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event) => res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  const lastEventId = Number(req.headers['last-event-id'] || req.query.lastEventId || 0) || 0;

  const unsubscribe = subscribe(run._id, lastEventId, send);
  if (!unsubscribe) {
    // Process restarted or run finished long ago: replay terminal state from the database.
    send({ id: 1, type: run.status === 'completed' ? 'run.completed' : 'run.failed', data: snapshot(run) });
    return res.end();
  }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on('close', close);
  res.on('close', close);

  if (!isActive(run._id)) {
    close();
    res.end();
  }
});

const snapshot = (run) => ({
  runId: String(run._id),
  finalAnswer: run.finalAnswer,
  keyCorrections: run.keyCorrections,
  remainingUncertainty: run.remainingUncertainty,
  sourcesUsed: run.sources,
  error: run.error,
  replayed: true,
});
