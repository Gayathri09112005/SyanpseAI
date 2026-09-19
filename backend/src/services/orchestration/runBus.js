import { EventEmitter } from 'node:events';

/**
 * In-process pub/sub for live run events, with a replay buffer so a client that
 * connects (or reconnects) mid-run receives everything it missed.
 * ponytail: single-process only; swap for Redis pub/sub when you run >1 instance.
 */
const buffers = new Map(); // runId -> { events: [], emitter, controller, terminal }
const MAX_BUFFER = 500;
const TTL_MS = 30 * 60 * 1000;

export function openRun(runId, controller) {
  const entry = { events: [], emitter: new EventEmitter(), controller, terminal: false, createdAt: Date.now() };
  entry.emitter.setMaxListeners(50);
  buffers.set(String(runId), entry);
  sweep();
  return entry;
}

export function publish(runId, type, data = {}) {
  const key = String(runId);
  const entry = buffers.get(key);
  if (!entry) return null;
  const event = { id: entry.events.length + 1, type, data, at: new Date().toISOString() };
  entry.events.push(event);
  if (entry.events.length > MAX_BUFFER) entry.events.shift();
  if (['run.completed', 'run.failed', 'run.cancelled'].includes(type)) entry.terminal = true;
  entry.emitter.emit('event', event);
  return event;
}

export function subscribe(runId, lastEventId, listener) {
  const entry = buffers.get(String(runId));
  if (!entry) return null;
  for (const event of entry.events) if (event.id > lastEventId) listener(event);
  if (entry.terminal) return () => {};
  entry.emitter.on('event', listener);
  return () => entry.emitter.off('event', listener);
}

export function cancelRun(runId) {
  const entry = buffers.get(String(runId));
  if (!entry || entry.terminal) return false;
  entry.controller.abort(new Error('cancelled'));
  return true;
}

export const isActive = (runId) => {
  const entry = buffers.get(String(runId));
  return Boolean(entry && !entry.terminal);
};

export const activeCount = () => [...buffers.values()].filter((e) => !e.terminal).length;

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of buffers) if (entry.terminal && entry.createdAt < cutoff) buffers.delete(key);
}

export const __reset = () => buffers.clear();
