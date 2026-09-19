'use client';

import { useState } from 'react';
import { useRailFocus } from '@/hooks/useRailFocus';
import { Markdown } from '@/components/Markdown';
import { compareTabs } from './derive';

export function Compare({ run, conversationId, onBack }) {
  const [tab, setTab] = useState('final');
  const railRef = useRailFocus(`${tab}:${Boolean(run?.agents?.generator)}`, '[aria-selected="true"]');

  if (!run || run.status === 'idle' || !run.agents.generator) {
    return (
      <div className="page" style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 24px 60px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
        <Header conversationId={conversationId} passes={0} />
        <section style={{ border: '1px dashed var(--line2)', background: 'var(--g2)', borderRadius: 'var(--r-l)', padding: '56px 24px', textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
          <div className="disp" style={{ fontSize: 20 }}>Nothing to compare yet</div>
          <div style={{ fontSize: 15, color: 'var(--fg2)', maxWidth: '46ch' }}>
            Run a question, or open one from your history, and every version of its answer will appear here.
          </div>
          <button type="button" onClick={onBack} className="btn-accent lift bright" style={{ padding: '11px 20px', borderRadius: 12, fontSize: 14 }}>
            Go to the workspace
          </button>
        </section>
      </div>
    );
  }

  const tabs = compareTabs(run);
  const current = tabs.find((t) => t.id === tab) || tabs.at(-1);
  const draft = run.agents.generator?.output?.answer;
  const passes = run.refinements.filter((r) => !r.failed).length;
  const uncertain = run.result?.remainingUncertainty || [];

  return (
    <div className="page" style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 24px 60px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
      <Header conversationId={conversationId} passes={passes} />

      <div ref={railRef} role="tablist" aria-label="Answer versions" className="rail rail-tabs" style={{ display: 'flex', gap: 4, padding: 5, borderRadius: 'var(--r-m)', border: '1px solid var(--line)', background: 'var(--g2)', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 var(--hl)', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className="lift1"
              style={{ flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--accent-line)' : 'transparent'}`, background: on ? 'var(--gac)' : 'transparent', color: on ? 'var(--fg)' : 'var(--fg2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background var(--ease),color var(--ease),transform var(--spring)' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="dot" style={{ background: t.dot }} />{t.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="compare-grid">
        <section key={current.id} role="tabpanel" className="panel-lg" style={{ border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)', borderRadius: 'var(--r-l)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', padding: '26px 28px', minWidth: 0, animation: 'rise 340ms cubic-bezier(.22,1.2,.36,1) backwards' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div className="disp" style={{ fontSize: 21, letterSpacing: '-.02em' }}>{current.title}</div>
            <div style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--g2)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)' }}>{current.meta}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            {current.markdown !== undefined ? (
              <Markdown className="muted">{current.markdown}</Markdown>
            ) : (
              <div style={{ display: 'grid', gap: 12, fontSize: 16, lineHeight: 1.66, color: 'var(--fg2)' }}>
                {current.paragraphs.filter(Boolean).map((p, i) => <p key={i} style={{ margin: 0, textWrap: 'pretty' }}>{p}</p>)}
              </div>
            )}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={{ border: '1px solid var(--line)', background: 'var(--g2)', backdropFilter: 'blur(18px)', borderRadius: 'var(--r-l)', boxShadow: 'inset 0 1px 0 var(--hl)', padding: 20 }}>
            <div className="mono-label" style={{ marginBottom: 12 }}>CHANGES IN THIS STEP</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {current.changes.length ? current.changes.map((c, i) => (
                <div key={i} style={{ display: 'grid', gap: 5, padding: '12px 14px', borderRadius: 'var(--r-m)', border: '1px solid var(--line)', background: 'var(--g1)', boxShadow: 'inset 0 1px 0 var(--hl)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.color, fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                    <span className="dot" style={{ background: c.color }} />{c.kind}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--fg)', lineHeight: 1.5 }}>{c.text}</div>
                  {c.why ? <div style={{ fontSize: 13, color: 'var(--fg3)', lineHeight: 1.45 }}>{c.why}</div> : null}
                </div>
              )) : (
                <div style={{ fontSize: 13.5, color: 'var(--fg3)' }}>Nothing recorded for this step.</div>
              )}
            </div>
          </div>
          <div className="inset" style={{ borderColor: 'var(--line2)', borderRadius: 'var(--r-l)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              <span className="dot" style={{ background: 'var(--unver)' }} />Carried forward as uncertain
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {uncertain.length ? uncertain.map((u, i) => (
                <div key={i} style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>{u}</div>
              )) : (
                <div style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
                  {run.result ? 'Nothing was flagged as still uncertain.' : 'The run has not finished.'}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section style={{ border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(22px)', borderRadius: 'var(--r-l)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div className="disp" style={{ fontSize: 18, letterSpacing: '-.02em' }}>Draft vs. final, side by side</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)' }}>
            {run.result ? `${run.result.keyCorrections.length} correction${run.result.keyCorrections.length === 1 ? '' : 's'}` : 'final pending'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))' }}>
          <div className="answer-article" style={{ padding: '22px 24px', borderRight: '1px solid var(--line)', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--warn)', marginBottom: 10 }}>DRAFT</div>
            {draft ? <Markdown className="muted">{draft}</Markdown> : <div style={{ fontSize: 14, color: 'var(--fg3)' }}>Draft transcript not retained.</div>}
          </div>
          <div className="answer-article" style={{ padding: '22px 24px', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ok)', marginBottom: 10 }}>FINAL</div>
            {run.result ? <Markdown>{run.result.finalAnswer}</Markdown> : <div style={{ fontSize: 14, color: 'var(--fg3)' }}>No final answer yet.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Header({ conversationId, passes }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div>
        <h2 className="disp" style={{ fontSize: 'clamp(26px,3vw,36px)', letterSpacing: '-.03em', margin: 0 }}>What changed, and why</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--fg2)', fontSize: 15.5, maxWidth: '64ch', textWrap: 'pretty' }}>
          Every version of this answer is kept. Agreement between models is recorded, not treated as proof.
        </p>
      </div>
      <div className="meta">
        {conversationId ? `conversation ${conversationId.slice(-6)} · ` : ''}{passes} refinement pass{passes === 1 ? '' : 'es'}
      </div>
    </div>
  );
}
