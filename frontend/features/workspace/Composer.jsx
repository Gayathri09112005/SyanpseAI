'use client';

import { useEffect, useRef, useState } from 'react';
import { STYLES } from './derive';

const PROMPTS = ['Summarize the evidence on X', 'Check this claim for me', 'Where do these two papers disagree?', 'What would falsify this?'];

export function Composer({ style, onStyle, onRun, onCancel, busy, providersLine, isFollowUp, focusSignal }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (focusSignal) ref.current?.focus();
  }, [focusSignal]);

  const submit = () => {
    const q = text.trim();
    if (q.length < 3) {
      setError('Ask a question of at least 3 characters.');
      ref.current?.focus();
      return;
    }
    setError(null);
    onRun(q);
    setText('');
  };

  return (
    <section className="glass1" style={{ borderRadius: 5, padding: 20, backdropFilter: 'blur(24px) saturate(1.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="disp" style={{ fontSize: 20, letterSpacing: '-.02em' }}>Ask SynapseAI</div>
        <div className="meta">{providersLine}</div>
      </div>
      <div className="focus-accent" style={{ border: `1px solid ${error ? 'var(--err)' : 'var(--line2)'}`, background: 'var(--gin)', borderRadius: 4, padding: '16px 18px', boxShadow: 'inset 0 1px 0 var(--hl)' }}>
        <label htmlFor="question" className="sr-only">Your question</label>
        <textarea
          id="question"
          ref={ref}
          rows={3}
          maxLength={8000}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) submit();
          }}
          placeholder={isFollowUp
            ? 'Ask a follow-up in this conversation. The agents see the recent exchange as context.'
            : 'Ask a question worth checking. Long questions are welcome — paste context, constraints, and what you already ruled out.'}
          aria-invalid={Boolean(error)}
          style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--fg)', fontSize: 17, lineHeight: 1.55, outline: 'none', resize: 'vertical' }}
        />
        {error ? <div role="alert" style={{ fontSize: 13, color: 'var(--err)', marginTop: 6 }}>{error}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="radiogroup" aria-label="Answer style">
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)', marginRight: 4 }}>STYLE</span>
            {STYLES.map((s) => {
              const on = style === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onStyle(s.value)}
                  className="lift1"
                  style={{ padding: '6px 12px', borderRadius: 4, border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`, background: on ? 'var(--accent-soft)' : 'var(--g2)', color: on ? 'var(--accent)' : 'var(--fg2)', fontSize: 13, cursor: 'pointer', transition: 'transform var(--spring)' }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {busy ? (
              <button type="button" onClick={onCancel} className="btn-glass lift" style={{ padding: '10px 16px', borderRadius: 5, fontSize: 14, fontWeight: 500 }}>
                Cancel run
              </button>
            ) : (
              <button type="button" onClick={() => { setText(''); setError(null); }} className="btn-glass lift" style={{ padding: '10px 16px', borderRadius: 5, fontSize: 14, fontWeight: 500 }}>
                Clear
              </button>
            )}
            <button type="button" onClick={submit} disabled={busy} className="btn-accent lift bright" style={{ padding: '10px 20px', borderRadius: 5, fontSize: 14 }}>
              {busy ? 'Running…' : 'Run 3 agents'}
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setText(p); ref.current?.focus(); }}
            className="lift to-fg"
            style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g2)', color: 'var(--fg2)', fontSize: 13.5, cursor: 'pointer', transition: 'transform var(--spring),color var(--ease)' }}
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}
