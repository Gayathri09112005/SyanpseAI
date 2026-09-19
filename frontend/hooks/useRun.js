'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { answers } from '@/lib/api';

const EVENT_TYPES = [
  'run.started', 'evidence.started', 'evidence.completed',
  'agent.started', 'agent.completed', 'agent.failed',
  'refinement.started', 'refinement.completed', 'refinement.failed',
  'run.completed', 'run.failed', 'run.cancelled',
];

const EMPTY = {
  runId: null,
  status: 'idle',
  stage: null,
  agents: {},
  evidence: null,
  refinements: [],
  result: null,
  error: null,
  timeline: [],
};

function reduceEvent(state, type, data) {
  const next = { ...state, timeline: [...state.timeline, { type, data, at: Date.now() }] };

  switch (type) {
    case 'run.started':
      return { ...next, status: 'running', runId: data.runId, stage: 'generate' };
    case 'evidence.started':
      return { ...next, evidence: { status: 'running' } };
    case 'evidence.completed':
      return { ...next, evidence: { status: 'done', count: data.count, sources: data.sources || [], error: data.error } };
    case 'agent.started':
      return {
        ...next,
        stage: data.stage,
        agents: { ...next.agents, [data.agent]: { ...next.agents[data.agent], status: 'running', label: data.label } },
      };
    case 'agent.completed':
      return {
        ...next,
        agents: {
          ...next.agents,
          [data.agent]: { status: 'completed', label: data.label, provider: data.provider, model: data.model, mode: data.mode, durationMs: data.durationMs, summary: data.summary, output: data.output },
        },
      };
    case 'agent.failed':
      return {
        ...next,
        agents: { ...next.agents, [data.agent]: { status: 'failed', label: data.label, error: data.error } },
      };
    case 'refinement.started':
      return { ...next, stage: 'refine' };
    case 'refinement.completed':
      return { ...next, refinements: [...next.refinements, data] };
    case 'refinement.failed':
      return { ...next, refinements: [...next.refinements, { ...data, failed: true }] };
    case 'run.completed':
      return { ...next, status: 'completed', stage: 'done', result: data };
    case 'run.failed':
      return { ...next, status: 'failed', error: data.error };
    case 'run.cancelled':
      return { ...next, status: 'cancelled' };
    default:
      return next;
  }
}

/**
 * Drives one pipeline run and mirrors the backend's SSE events.
 * Nothing here simulates progress: every state change comes from a server event.
 */
export function useRun({ onComplete, onEnd } = {}) {
  const [state, setState] = useState(EMPTY);
  const sourceRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const onEndRef = useRef(onEnd);
  onCompleteRef.current = onComplete;
  onEndRef.current = onEnd;

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => close, [close]);

  const attach = useCallback(
    (runId) => {
      close();
      const source = new EventSource(`/api/v1/answers/${runId}/stream`, { withCredentials: true });
      sourceRef.current = source;

      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (event) => {
          const data = JSON.parse(event.data);
          setState((prev) => reduceEvent(prev, type, data));
          if (type === 'run.completed') onCompleteRef.current?.(data);
          if (['run.completed', 'run.failed', 'run.cancelled'].includes(type)) {
            onEndRef.current?.(type);
            close();
          }
        });
      }
      // The browser retries automatically with Last-Event-ID; the server replays the gap.
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
          setState((prev) =>
            prev.status === 'running'
              ? { ...prev, status: 'failed', error: { message: 'Lost connection to the reasoning stream.' } }
              : prev,
          );
        }
      };
    },
    [close],
  );

  const start = useCallback(
    async (payload, mode = 'create') => {
      setState({ ...EMPTY, status: 'starting' });
      try {
        const res =
          mode === 'create'
            ? await answers.create(payload)
            : mode === 'follow-up'
              ? await answers.followUp(payload.runId, { question: payload.question, settings: payload.settings })
              : await answers.regenerate(payload.runId);
        setState((prev) => ({ ...prev, runId: res.run.id, status: 'running' }));
        attach(res.run.id);
        return res.run;
      } catch (err) {
        setState((prev) => ({ ...prev, status: 'failed', error: { message: err.message, code: err.code } }));
        throw err;
      }
    },
    [attach],
  );

  const cancel = useCallback(async () => {
    if (!state.runId) return;
    await answers.cancel(state.runId).catch(() => {});
  }, [state.runId]);

  const reset = useCallback(() => {
    close();
    setState(EMPTY);
  }, [close]);

  /** Rebuild live-shaped state from a persisted run, so history reopens identically. */
  const hydrate = useCallback((run) => {
    close();
    setState({
      ...EMPTY,
      runId: run.id,
      status: run.status,
      stage: run.status === 'completed' ? 'done' : null,
      agents: Object.fromEntries(
        Object.entries(run.agents || {}).map(([key, a]) => [
          key,
          { status: a.status, provider: a.provider, model: a.model, mode: a.mode, durationMs: a.durationMs, output: a.output, error: a.error },
        ]),
      ),
      evidence: run.sources?.length ? { status: 'done', count: run.sources.length, sources: run.sources } : null,
      refinements: (run.refinementHistory || []).map((r) => ({ iteration: r.iteration, answer: r.answer })),
      result:
        run.status === 'completed'
          ? {
              runId: run.id,
              finalAnswer: run.finalAnswer,
              keyCorrections: run.keyCorrections,
              remainingUncertainty: run.remainingUncertainty,
              sourcesUsed: run.sources,
              degraded: run.degraded,
              usage: run.usage,
              durationMs: run.durationMs,
              refinementPasses: (run.refinementHistory || []).length,
            }
          : null,
      error: run.error,
    });
  }, [close]);

  return { ...state, start, cancel, reset, hydrate };
}
