'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRailFocus } from '@/hooks/useRailFocus';
import { Markdown } from '@/components/Markdown';
import { StatusDot } from '@/components/Controls';
import {
  STATUS_COLOR, STATUS_LABEL, agentDetails, agentFinding, modelLine, pipelineStatuses, runningLabel,
} from './derive';

const STEPS = [
  ['generate', 'Generate'], ['verify', 'Verify'], ['reason', 'Reason'], ['refine', 'Refine'], ['synthesize', 'Synthesize'],
];

const AGENTS = [
  { key: 'generator', name: 'Answer Generator', provider: 'gemini', role: 'Drafts the first answer from the question and any supplied context.' },
  { key: 'verifier', name: 'Verifier', provider: 'groq', role: 'Checks each factual claim against retrieved evidence and flags what cannot be sourced.' },
  { key: 'reasoner', name: 'Reasoning Agent', provider: 'huggingface', role: 'Audits logic, hidden assumptions, contradictions and missing steps.' },
];

export function AgentPanel({ run, providers, expanded, onToggle }) {
  const statuses = run.status === 'idle' ? {} : pipelineStatuses(run);
  const activeStep = STEPS.find(([key]) => statuses[key] === 'running')?.[0] || 'none';
  const railRef = useRailFocus(activeStep, `[data-step="${activeStep}"]`);

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
      <ol ref={railRef} className="rail" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }} aria-label="Pipeline">
        {STEPS.map(([key, label]) => {
          const s = statuses[key] || 'waiting';
          return (
            <li
              key={key}
              data-step={key}
              aria-label={`${label}: ${STATUS_LABEL[s]}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 4,
                border: `1px solid ${s === 'running' ? 'var(--accent-line)' : 'var(--line)'}`,
                background: s === 'done' ? 'var(--g1)' : s === 'running' ? 'var(--gac)' : 'var(--gdis)',
                color: s === 'waiting' || s === 'skipped' ? 'var(--fg3)' : 'var(--fg)',
                fontSize: 13.5, fontWeight: 500, backdropFilter: 'blur(14px)', boxShadow: 'inset 0 1px 0 var(--hl)',
                transition: 'background var(--ease),border-color var(--ease),color var(--ease)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s] }} />
              {label}
            </li>
          );
        })}
      </ol>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 14 }}>
        {AGENTS.map((a, i) => {
          const state = run.agents[a.key];
          const s = run.status === 'idle' ? 'waiting' : statuses[{ generator: 'generate', verifier: 'verify', reasoner: 'reason' }[a.key]];
          const details = agentDetails(a.key, state);
          const open = Boolean(expanded[a.key]);
          return (
            <div
              key={a.key}
              id={`agent-${a.key}`}
              className="lift4 panel"
              style={{
                border: `1px solid ${s === 'running' ? 'var(--accent-line)' : s === 'failed' ? 'var(--err)' : 'var(--line)'}`,
                background: s === 'running' ? 'var(--gac)' : 'var(--g1)',
                backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', borderRadius: 5,
                boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', padding: 20, display: 'grid', gap: 12, alignContent: 'start',
                animation: `popin 520ms cubic-bezier(.22,1.2,.36,1) ${i * 60}ms backwards`, scrollMarginTop: 100,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="disp" style={{ fontSize: 18, letterSpacing: '-.02em' }}>{a.name}</div>
                  <div className="meta" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{modelLine(state, a.provider, providers)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g2)', fontSize: 12, color: STATUS_COLOR[s], whiteSpace: 'nowrap' }}>
                  <StatusDot color={STATUS_COLOR[s]} spin={s === 'running'} />
                  {STATUS_LABEL[s]}
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--fg3)', lineHeight: 1.5 }}>{a.role}</div>
              <div className="inset" style={{ padding: '12px 14px', borderRadius: 4, fontSize: 14, lineHeight: 1.5, color: s === 'failed' ? 'var(--err)' : 'var(--fg)' }}>
                {agentFinding(a.key, state, run)}
              </div>
              <AnimatePresence initial={false}>
                {open && details.length ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'grid', gap: 8 }}>
                      {details.map((d, n) => (
                        <div key={n} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--accent)' }}>—</span><span>{d}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {details.length ? (
                <button
                  type="button"
                  onClick={() => onToggle(a.key)}
                  aria-expanded={open}
                  className="btn-ghost"
                  style={{ justifySelf: 'start', padding: '7px 13px', borderRadius: 4, fontSize: 13 }}
                >
                  {open ? 'Hide details' : 'Show details'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function IdleState() {
  return (
    <section style={{ border: '1px dashed var(--line2)', background: 'var(--g2)', borderRadius: 5, padding: '56px 24px', textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 5, border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 12, height: 12, background: 'var(--accent)', borderRadius: 3, transform: 'rotate(45deg)' }} />
      </div>
      <div className="disp" style={{ fontSize: 20 }}>No answer yet</div>
      <div style={{ fontSize: 15, color: 'var(--fg2)', maxWidth: '46ch' }}>
        Ask a question and three models will work it in sequence. You will see each contribution as it lands.
      </div>
    </section>
  );
}

export function RunningState({ run, showDraft }) {
  const draft = run.agents.generator?.output?.answer;
  return (
    <section style={{ border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(20px)', borderRadius: 5, boxShadow: 'inset 0 1px 0 var(--hl)', padding: 24, display: 'grid', gap: 12 }} aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--fg2)' }}>
        <span className="spinner" aria-hidden />
        {runningLabel(run)}
      </div>
      {showDraft && draft ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="mono-label" style={{ color: 'var(--warn)' }}>DRAFT · NOT YET VERIFIED</div>
          <Markdown className="muted">{draft}</Markdown>
        </div>
      ) : (
        <>
          <div style={{ height: 12, borderRadius: 6, background: 'var(--gin)', width: '72%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'var(--gin)', width: '94%' }} />
          <div style={{ height: 12, borderRadius: 6, background: 'var(--gin)', width: '61%' }} />
        </>
      )}
    </section>
  );
}

export function EndedState({ run, onRetry }) {
  const cancelled = run.status === 'cancelled';
  return (
    <section style={{ border: '1px solid var(--line2)', background: 'var(--gin)', borderRadius: 5, boxShadow: 'inset 0 1px 0 var(--hl)', padding: '18px 20px', display: 'grid', gap: 10 }} role="status">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600 }}>
        <span className="dot" style={{ background: cancelled ? 'var(--unver)' : 'var(--err)' }} />
        {cancelled ? 'Run cancelled' : 'This run did not produce an answer'}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
        {cancelled
          ? 'Nothing was saved as an answer. Agents that had already finished keep their findings above.'
          : run.error?.message || 'The pipeline stopped before synthesis. No answer was invented to fill the gap.'}
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-glass lift" style={{ justifySelf: 'start', padding: '8px 14px', borderRadius: 4, fontSize: 13.5 }}>
          Run again
        </button>
      ) : null}
    </section>
  );
}
