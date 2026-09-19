'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { system } from '@/lib/api';
import { useSession } from '@/hooks/useAuth';

const STAGES = ['generate', 'verify', 'reason', 'refine', 'synthesize'];
const STAGE_DOTS = ['var(--ok)', 'var(--run)', 'var(--warn)', 'var(--accent)', 'var(--unver)'];

const WORKFLOW = [
  { n: '01', title: 'Generate', body: 'One model drafts the answer and declares every claim it makes.' },
  { n: '02', title: 'Verify', body: 'A second model retrieves evidence and marks each claim supported, corrected or unsourced.' },
  { n: '03', title: 'Reason', body: 'A third audits the logic: assumptions, contradictions, missing steps.' },
  { n: '04', title: 'Refine', body: 'Corrections are applied in place, bounded by your refinement limit.' },
  { n: '05', title: 'Synthesize', body: 'The final answer ships with its verification record attached.' },
];

const FEATURES = [
  { k: '◫', title: 'Claim-level provenance', body: 'Every sentence carries its status. Supported claims link to evidence; unverified claims stay visibly marked in the final text.' },
  { k: '◐', title: 'Disagreement kept intact', body: 'When the verifier and the reasoning agent conflict, both positions survive into the answer instead of being averaged away.' },
  { k: '⌁', title: 'Tunable depth', body: 'Reasoning depth and refinement limits are sliders, not hidden defaults. Fast for lookups, exhaustive for research.' },
  { k: '⎔', title: 'Readable diffs', body: 'Compare the draft, the critique and the final answer side by side, with each change traced to the agent that caused it.' },
];

const PRIVACY = [
  { t: 'Your history is yours alone', b: 'Conversations are visible only to your account. Delete any of them — or the whole account — at any time.' },
  { t: 'Transcripts are optional', b: 'Turn retention off and only the final answer is stored; every agent transcript is discarded.' },
  { t: 'Provider routing is visible', b: 'You always see which model handled which role.' },
  { t: 'Evidence retrieval is opt-in', b: 'Turn it off and the verifier marks factual claims unverified instead of guessing at sources.' },
];

const PATHS = [
  'M152 190 C 250 190, 262 68, 358 68',
  'M152 190 L 358 190',
  'M152 190 C 250 190, 262 312, 358 312',
  'M572 68 C 612 68, 600 190, 628 190',
  'M572 190 L 628 190',
  'M572 312 C 612 312, 600 190, 628 190',
  'M772 190 L 848 190',
];

const nodeBox = {
  borderRadius: 'var(--r-m)', border: '1px solid var(--line2)', background: 'var(--g1)',
  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)',
};

export function Landing() {
  const router = useRouter();
  const { data: user } = useSession();
  const { data: status } = useQuery({ queryKey: ['providers'], queryFn: system.providers, staleTime: 60_000 });
  const modelOf = (name, fallback) => status?.providers?.find((p) => p.provider === name)?.model || fallback;

  // Honour /#section links arriving from other pages.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96 });
  }, []);

  const goApp = () => router.push(user ? '/workspace' : '/login');
  const goAuth = () => router.push('/login');
  const goCompare = () => router.push(user ? '/workspace?view=compare' : '/login');

  const heroNodes = [
    { name: 'Answer Generator', model: modelOf('gemini', 'gemini'), note: 'Drafting six claims', top: '18%', dot: 'var(--ok)', line: 'var(--line2)' },
    { name: 'Verifier', model: modelOf('groq', 'groq'), note: '4 supported · 1 corrected', top: '50%', dot: 'var(--accent)', line: 'var(--accent-line)' },
    { name: 'Reasoning Agent', model: modelOf('huggingface', 'huggingface'), note: '2 logical gaps found', top: '82%', dot: 'var(--warn)', line: 'var(--line2)' },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px' }}>
      <section id="overview" style={{ padding: '72px 0 28px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 26, justifyItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {STAGES.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 15px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--g2)', fontFamily: 'var(--mono)', fontSize: 11.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--fg2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STAGE_DOTS[i] }} />
                <span style={{ color: 'var(--fg3)' }}>0{i + 1}</span>
                {label}
              </div>
              {i < STAGES.length - 1 ? <div style={{ width: 26, height: 1, background: 'var(--line2)' }} /> : null}
            </div>
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(14px)', fontSize: 13, color: 'var(--fg2)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />
          Three models. One accountable answer.
        </div>
        <h1 className="disp" style={{ fontSize: 'clamp(40px,6.2vw,76px)', lineHeight: 1.02, letterSpacing: '-.035em', margin: 0, maxWidth: '16ch', textWrap: 'balance' }}>
          Think together. Verify smarter.
        </h1>
        <p style={{ margin: 0, maxWidth: '62ch', fontSize: 'clamp(17px,1.6vw,20px)', color: 'var(--fg2)', lineHeight: 1.6, textWrap: 'pretty' }}>
          SynapseAI routes every question through a generator, a verifier, and a reasoning critic. You see what each one
          contributed, what was corrected, and what is still uncertain — before you trust the answer.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={goApp} className="btn-accent lift bright" style={{ padding: '13px 24px', borderRadius: 14, fontSize: 15 }}>
            Open the workspace
          </button>
          <button type="button" onClick={goCompare} className="btn-glass lift" style={{ padding: '13px 24px', borderRadius: 14, fontSize: 15, fontWeight: 600, backdropFilter: 'blur(16px)' }}>
            See a verified answer
          </button>
        </div>
      </section>

      <section style={{ margin: '26px 0 0', position: 'relative', border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(26px) saturate(1.4)', WebkitBackdropFilter: 'blur(26px) saturate(1.4)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh),inset 0 1px 0 var(--hl)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 22px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg3)' }}>Live pipeline</div>
          <div style={{ fontSize: 13.5, color: 'var(--fg2)' }}>“Does raising the minimum wage reduce employment?”</div>
        </div>
        <div style={{ position: 'relative', height: 380, minWidth: 0 }} aria-label="Illustration: question flows to three agents, then synthesis, then a verified answer" role="img">
          <svg viewBox="0 0 1000 380" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
            <g fill="none" stroke="var(--line2)" strokeWidth="1.25" vectorEffect="non-scaling-stroke">
              {PATHS.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
            </g>
            <g fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 9" style={{ animation: 'dashmove 1.3s linear infinite' }}>
              {PATHS.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
            </g>
          </svg>
          <div style={{ ...nodeBox, position: 'absolute', left: '2%', top: '50%', transform: 'translateY(-50%)', width: '13%', minWidth: 96, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.09em', color: 'var(--fg3)' }}>INPUT</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Question</div>
          </div>
          {heroNodes.map((n) => (
            <div key={n.name} style={{ ...nodeBox, border: `1px solid ${n.line}`, position: 'absolute', left: '36%', top: n.top, transform: 'translateY(-50%)', width: '21%', minWidth: 150, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.dot, animation: 'blink 1.8s ease-in-out infinite' }} />
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>{n.name}</div>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.model}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.4 }}>{n.note}</div>
            </div>
          ))}
          <div style={{ position: 'absolute', left: '70%', top: '50%', transform: 'translate(-50%,-50%)', width: '14%', minWidth: 112, padding: '16px 12px', borderRadius: '50%', aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-line)', background: 'var(--gac)', backdropFilter: 'blur(18px)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', animation: 'pulsering 2.6s ease-out infinite' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Synthesis</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--fg3)', marginTop: 3 }}>2 refinements</div>
          </div>
          <div style={{ ...nodeBox, position: 'absolute', right: '2%', top: '50%', transform: 'translateY(-50%)', width: '13%', minWidth: 96, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.09em', color: 'var(--ok)' }}>VERIFIED</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Answer</div>
          </div>
        </div>
      </section>

      <section id="steps" style={{ padding: '76px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <h2 className="disp" style={{ fontSize: 'clamp(26px,3vw,38px)', letterSpacing: '-.025em', margin: 0 }}>Five steps, all of them visible</h2>
          <div style={{ fontSize: 14, color: 'var(--fg3)', fontFamily: 'var(--mono)' }}>verify ∥ reason run in parallel</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          {WORKFLOW.map((w) => (
            <div key={w.n} className="glass2 lift4 hover-g1" style={{ padding: '20px 18px', borderRadius: 'var(--r-m)', backdropFilter: 'blur(16px)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{w.n}</div>
              <div className="disp" style={{ fontSize: 18, marginTop: 10, letterSpacing: '-.015em' }}>{w.title}</div>
              <div style={{ fontSize: 14, color: 'var(--fg2)', marginTop: 7, lineHeight: 1.5 }}>{w.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '60px 0 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="lift5" style={{ padding: '26px 24px', borderRadius: 'var(--r-l)', border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(20px)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--g2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{f.k}</div>
            <div className="disp" style={{ fontSize: 21, marginTop: 16, letterSpacing: '-.02em' }}>{f.title}</div>
            <div style={{ fontSize: 15, color: 'var(--fg2)', marginTop: 9, lineHeight: 1.55, textWrap: 'pretty' }}>{f.body}</div>
          </div>
        ))}
      </section>

      <section id="transparency" style={{ margin: '60px 0 0', padding: 34, borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', background: 'var(--g2)', backdropFilter: 'blur(20px)', boxShadow: 'inset 0 1px 0 var(--hl)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 34 }}>
        <div>
          <h2 className="disp" style={{ fontSize: 'clamp(24px,2.6vw,32px)', letterSpacing: '-.025em', margin: '0 0 12px' }}>Transparency is the product</h2>
          <p style={{ margin: 0, color: 'var(--fg2)', fontSize: 15.5, lineHeight: 1.6, maxWidth: '52ch', textWrap: 'pretty' }}>
            Agreement between models is not proof. SynapseAI shows disagreement as prominently as consensus, labels every
            claim it could not source, and never hides a correction inside a rewritten paragraph.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          {PRIVACY.map((p) => (
            <div key={p.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--r-m)', border: '1px solid var(--line)', background: 'var(--g1)', boxShadow: 'inset 0 1px 0 var(--hl)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 8, flex: 'none' }} />
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.t}</div>
                <div style={{ fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.45 }}>{p.b}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ margin: '56px 0 0', padding: '48px 34px', borderRadius: 'var(--r-xl)', border: '1px solid var(--accent-line)', background: 'var(--gac)', backdropFilter: 'blur(22px)', boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', display: 'grid', gap: 16, justifyItems: 'center', textAlign: 'center' }}>
        <h2 className="disp" style={{ fontSize: 'clamp(24px,3vw,34px)', letterSpacing: '-.03em', margin: 0, maxWidth: '22ch' }}>
          Sign in to run your own questions through all three agents.
        </h2>
        <p style={{ margin: 0, color: 'var(--fg2)', fontSize: 15.5, maxWidth: '52ch', lineHeight: 1.6, textWrap: 'pretty' }}>
          The workspace, the verification record and your conversation history unlock once you are signed in. Reading
          the method needs no account.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button type="button" onClick={goAuth} className="btn-accent lift bright" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, padding: '0 26px', borderRadius: 999, fontSize: 15 }}>
            Sign in to SynapseAI
          </button>
          <button type="button" onClick={goApp} className="btn-glass lift" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, padding: '0 26px', borderRadius: 999, fontSize: 15, fontWeight: 600 }}>
            Ask a question
          </button>
        </div>
      </section>

      <footer style={{ marginTop: 56, padding: '26px 4px', borderTop: '1px solid var(--line)', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', color: 'var(--fg3)', fontSize: 13.5 }}>
        <div>© 2026 SynapseAI — Think together. Verify smarter. Answer with confidence.</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <a href="#overview">Model providers</a>
          <a href="#transparency">Evidence policy</a>
          <a href="#transparency">Security</a>
          <a href="#steps">Docs</a>
        </div>
      </footer>
    </div>
  );
}
