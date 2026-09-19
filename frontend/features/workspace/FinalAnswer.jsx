'use client';

import { useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { evidenceItems, verificationCounts } from './derive';

const chipStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g1)', fontSize: 12.5 };
const headBtn = { padding: '8px 14px', borderRadius: 4, fontSize: 13.5 };

function exportMarkdown(question, result, evidence) {
  const lines = [`# ${question || 'SynapseAI answer'}`, '', result.finalAnswer];
  if (result.keyCorrections?.length) lines.push('', '## Corrections applied', ...result.keyCorrections.map((c) => `- ${c}`));
  if (result.remainingUncertainty?.length) lines.push('', '## Still uncertain', ...result.remainingUncertainty.map((c) => `- ${c}`));
  const sourced = evidence.filter((e) => e.url);
  if (sourced.length) lines.push('', '## Evidence', ...sourced.map((e) => `- [${e.title}](${e.url})`));
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'synapseai-answer.md' });
  a.click();
  URL.revokeObjectURL(url);
}

export function FinalAnswer({ run, question, busy, onRegenerate, onCompare, onShowAgent }) {
  const [copied, setCopied] = useState(false);
  const result = run.result;
  const counts = verificationCounts(run.agents.verifier?.output);
  const evidence = evidenceItems(run);
  const passes = result.refinementPasses ?? run.refinements.filter((r) => !r.failed).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.finalAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const meta = [
    'synthesized',
    result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : null,
    `${passes} pass${passes === 1 ? '' : 'es'}`,
    result.usage?.totalTokens ? `${result.usage.totalTokens.toLocaleString()} tokens` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section style={{ border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(26px) saturate(1.4)', WebkitBackdropFilter: 'blur(26px) saturate(1.4)', borderRadius: 6, boxShadow: 'var(--sh),inset 0 1px 0 var(--hl)', overflow: 'hidden', animation: 'rise 480ms cubic-bezier(.22,1.2,.36,1) backwards' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '18px 24px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: result.degraded ? 'var(--warn)' : 'var(--ok)' }} />
          <div className="disp" style={{ fontSize: 20, letterSpacing: '-.02em' }}>Final answer</div>
          <div className="meta">{meta}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={copy} className="btn-glass lift" style={headBtn}>{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={onRegenerate} disabled={busy} className="btn-glass lift" style={headBtn}>Regenerate</button>
          <button type="button" onClick={() => exportMarkdown(question, result, evidence)} className="btn-glass lift" style={headBtn}>Export</button>
          <button type="button" onClick={onCompare} className="btn-accent flat lift bright" style={headBtn}>Compare versions</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 24px', borderBottom: '1px solid var(--line)', background: 'var(--g2)' }}>
        <div style={chipStyle}><span className="dot" style={{ background: 'var(--ok)' }} />{counts.supported} claims supported</div>
        <div style={chipStyle}><span className="dot" style={{ background: 'var(--warn)' }} />{result.keyCorrections?.length || 0} corrected</div>
        <div style={chipStyle}><span className="dot" style={{ background: 'var(--unver)' }} />{counts.unverified} unverified</div>
        <div style={chipStyle}><span className="dot" style={{ background: 'var(--err)' }} />{counts.contradicted} contradictions</div>
        {!run.agents.verifier?.output ? (
          <div style={chipStyle}><span className="dot" style={{ background: 'var(--err)' }} />verifier did not report</div>
        ) : null}
      </div>

      <div className="answer-grid">
        <article style={{ padding: '26px 30px', minWidth: 0 }}>
          <Markdown>{result.finalAnswer}</Markdown>
        </article>

        <aside className="answer-aside" style={{ padding: '26px 24px', minWidth: 0, background: 'var(--g2)', display: 'grid', gap: 18, alignContent: 'start' }}>
          <div>
            <div className="mono-label" style={{ marginBottom: 10 }}>EVIDENCE</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {evidence.length ? evidence.map((e) => {
                const body = (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--fg)' }}>{e.title}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)', marginTop: 5 }}>{e.meta}</div>
                  </>
                );
                const style = { display: 'block', padding: '12px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g1)', boxShadow: 'inset 0 1px 0 var(--hl)', transition: 'transform var(--spring)' };
                return e.url ? (
                  <a key={e.key} href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="lift" style={style}>{body}</a>
                ) : (
                  <div key={e.key} style={style}>{body}</div>
                );
              }) : (
                <div style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
                  No external evidence was retrieved for this run. Turn on evidence retrieval to check claims against sources.
                </div>
              )}
            </div>
          </div>

          {result.remainingUncertainty?.length ? (
            <div className="inset" style={{ padding: '14px 16px', borderRadius: 4, borderColor: 'var(--line2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                <span className="dot" style={{ background: 'var(--unver)' }} />Still uncertain
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {result.remainingUncertainty.map((u, i) => (
                  <div key={i} style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5 }}>{u}</div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mono-label" style={{ marginBottom: 10 }}>AGENT FINDINGS</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                ['generator', 'Answer Generator'], ['verifier', 'Verifier'], ['reasoner', 'Reasoning Agent'],
              ].map(([key, name]) => {
                const a = run.agents[key];
                const color = a?.status === 'failed' ? 'var(--err)' : a?.status === 'completed' ? 'var(--ok)' : 'var(--unver)';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onShowAgent(key)}
                    className="lift"
                    style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g1)', color: 'var(--fg)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'transform var(--spring)' }}
                  >
                    <span className="dot" style={{ background: color }} />{name}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
