/**
 * Pure mappings from real run state (hooks/useRun) to what the design renders.
 * Nothing here invents data: a missing agent output produces an honest empty state.
 */

export const STATUS_COLOR = {
  waiting: 'var(--unver)', running: 'var(--run)', done: 'var(--ok)', failed: 'var(--err)', skipped: 'var(--fg3)',
};
export const STATUS_LABEL = {
  waiting: 'Waiting', running: 'Running', done: 'Completed', failed: 'Failed', skipped: 'Skipped',
};

const PROVIDER_NAME = { gemini: 'Google', groq: 'Groq', huggingface: 'Hugging Face', mock: 'mock' };
const TERMINAL = ['completed', 'failed', 'cancelled'];

const agentStatus = (a) =>
  !a ? 'waiting' : a.status === 'completed' ? 'done' : a.status === 'running' ? 'running' : a.status === 'failed' ? 'failed' : 'waiting';

export function pipelineStatuses(run) {
  const synth = agentStatus(run.agents.synthesizer);
  let refine = 'waiting';
  if (run.stage === 'refine') refine = 'running';
  else if (run.refinements.some((r) => r.failed)) refine = 'failed';
  else if (run.refinements.length) refine = 'done';
  else if (synth !== 'waiting' || TERMINAL.includes(run.status)) refine = 'skipped';

  const statuses = {
    generate: agentStatus(run.agents.generator),
    verify: agentStatus(run.agents.verifier),
    reason: agentStatus(run.agents.reasoner),
    refine,
    synthesize: synth,
  };
  // A cancelled/failed run leaves unreached steps skipped rather than forever "waiting".
  if (['failed', 'cancelled'].includes(run.status)) {
    for (const k of Object.keys(statuses)) if (statuses[k] === 'waiting' || statuses[k] === 'running') statuses[k] = 'skipped';
  }
  return statuses;
}

export function modelLine(agent, fallbackProvider, providers) {
  if (agent?.model) return `${agent.model} · ${PROVIDER_NAME[agent.provider] || agent.provider}${agent.mode === 'mock' ? ' · mock' : ''}`;
  const configured = providers?.find((p) => p.provider === fallbackProvider);
  if (configured) return `${configured.model} · ${PROVIDER_NAME[fallbackProvider]}${configured.mode === 'mock' ? ' · mock' : ''}`;
  return PROVIDER_NAME[fallbackProvider];
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function agentFinding(key, agent, run) {
  if (agent?.status === 'failed') return agent.error?.message || 'This agent did not complete. No findings were generated in its place.';
  const o = agent?.output;
  if (!o) {
    if (agent?.status === 'completed') return 'Completed. Its transcript was not retained.';
    if (agent?.status === 'running') return key === 'generator' ? 'Drafting the answer…' : key === 'verifier' ? 'Checking claims…' : 'Auditing the logic…';
    if (run.status === 'idle') return 'Waiting for a question.';
    return key === 'generator' ? 'Waiting to start.' : 'Starts when the draft answer is ready.';
  }
  if (key === 'generator') {
    return `Drafted an answer with ${plural(o.keyClaims.length, 'factual claim')}, ${plural(o.assumptions.length, 'stated assumption')} and ${plural(o.uncertainties.length, 'declared uncertainty', 'declared uncertainties')}.`;
  }
  if (key === 'verifier') {
    const c = verificationCounts(o);
    return `${plural(o.claims.length, 'claim')} checked — ${c.supported} supported, ${c.contradicted} contradicted, ${c.unverified} unverified.`;
  }
  const gaps = o.logicalIssues.length + o.missingSteps.length;
  return `${plural(gaps, 'logical gap')}, ${plural(o.assumptions.length, 'unstated assumption')}, ${plural(o.edgeCases.length, 'edge case')}.`;
}

export function agentDetails(key, agent) {
  const o = agent?.output;
  if (!o) return [];
  if (key === 'generator') {
    return [
      ...o.keyClaims.map((c) => `Claim: ${c}`),
      ...o.assumptions.map((a) => `Assumption: ${a}`),
      ...o.uncertainties.map((u) => `Uncertain: ${u}`),
    ];
  }
  if (key === 'verifier') {
    const label = {
      supported_by_evidence: 'Supported', contradicted_by_evidence: 'Contradicted', partially_supported: 'Partially supported',
      unverified: 'Unverified', not_checked: 'Not checked',
    };
    return [
      ...o.claims.map((c) => `${label[c.status] || 'Unverified'}: ${c.claim}${c.explanation ? ` — ${c.explanation}` : ''}`),
      ...o.issues.map((i) => `Issue (${i.severity}): ${i.description}`),
      ...o.missingInformation.map((m) => `Missing: ${m}`),
    ];
  }
  return [
    ...o.logicalIssues.map((i) => `Logical issue (${i.severity}): ${i.description}`),
    ...o.missingSteps.map((s) => `Missing step: ${s}`),
    ...o.assumptions.map((a) => `Unstated assumption: ${a}`),
    ...o.edgeCases.map((e) => `Edge case: ${e}`),
    ...o.suggestedImprovements.map((s) => `Suggestion: ${s}`),
  ];
}

export function verificationCounts(verification) {
  const claims = verification?.claims || [];
  const count = (...s) => claims.filter((c) => s.includes(c.status)).length;
  return {
    supported: count('supported_by_evidence', 'partially_supported'),
    contradicted: count('contradicted_by_evidence'),
    unverified: count('unverified', 'not_checked'),
  };
}

export function runningLabel(run) {
  const a = run.agents;
  if (run.status === 'starting' || !a.generator) return 'Queued';
  if (a.generator.status === 'running') return 'Generating the draft answer…';
  const v = a.verifier?.status === 'running';
  const r = a.reasoner?.status === 'running';
  if (v && r) return 'Verifying claims and auditing logic in parallel…';
  if (v) return 'Verifying claims against sources…';
  if (r) return 'Auditing logic and assumptions…';
  if (run.stage === 'refine') return 'Applying corrections…';
  if (a.synthesizer?.status === 'running') return 'Synthesizing the final answer…';
  if (run.evidence?.status === 'running') return 'Retrieving evidence…';
  return 'Working…';
}

/** Evidence aside: real sources annotated with the claims that cite them, then unsourced claims. */
export function evidenceItems(run) {
  const sources = run.result?.sourcesUsed?.length ? run.result.sourcesUsed : run.evidence?.sources || [];
  const claims = run.agents.verifier?.output?.claims || [];
  const items = sources.map((s, i) => {
    const citing = claims
      .map((c, n) => ({ c, n }))
      .filter(({ c }) => c.evidenceIds?.includes(i));
    const meta = citing.length
      ? citing.map(({ c, n }) => `${c.status === 'contradicted_by_evidence' ? 'contradicts' : 'supports'} claim ${n + 1}`).join(' · ')
      : 'not cited by any claim';
    return { key: s.url, title: s.title, url: s.url, meta: `retrieved · ${meta}` };
  });
  claims.forEach((c, n) => {
    if (['unverified', 'not_checked'].includes(c.status)) {
      items.push({ key: `u${n}`, title: c.claim, meta: 'no source found · left marked' });
    }
  });
  return items;
}

/** The five comparison tabs, built only from what the run actually produced. */
export function compareTabs(run) {
  const draft = run.agents.generator?.output;
  const ver = run.agents.verifier?.output;
  const rea = run.agents.reasoner?.output;
  const refined = run.refinements.filter((r) => !r.failed).at(-1);
  const secs = (a) => (a?.durationMs ? ` · ${(a.durationMs / 1000).toFixed(1)}s` : '');
  const counts = verificationCounts(ver);
  const unavailable = (who) => ({ markdown: `_${who} produced no retained output for this run._`, changes: [] });

  const initial = draft
    ? {
        markdown: draft.answer,
        changes: [{ kind: 'DRAFTED', color: 'var(--fg3)', text: `${plural(draft.keyClaims.length, 'factual claim')} declared.`, why: 'Nothing is checked at this stage.' }],
      }
    : unavailable('The Answer Generator');

  const verify = ver
    ? {
        paragraphs: [ver.summary, ...ver.claims.map((c) => `${c.claim}${c.explanation ? ` — ${c.explanation}` : ''}`)],
        changes: [
          counts.supported && { kind: 'SUPPORTED', color: 'var(--ok)', text: plural(counts.supported, 'claim'), why: 'Matched against retrieved evidence.' },
          counts.contradicted && { kind: 'CONTRADICTED', color: 'var(--err)', text: plural(counts.contradicted, 'claim'), why: 'Retrieved evidence says otherwise.' },
          counts.unverified && { kind: 'UNVERIFIED', color: 'var(--unver)', text: plural(counts.unverified, 'claim'), why: run.evidence ? 'No retrieved source settles these.' : 'Evidence retrieval was off, so nothing could be sourced.' },
          ...ver.issues.map((i) => ({ kind: `ISSUE · ${i.severity.toUpperCase()}`, color: 'var(--warn)', text: i.description, why: i.suggestedFix || '' })),
        ].filter(Boolean),
      }
    : unavailable('The Verifier');

  const reason = rea
    ? {
        paragraphs: [rea.summary],
        changes: [
          ...rea.logicalIssues.map((i) => ({ kind: 'LOGICAL ISSUE', color: i.severity === 'high' ? 'var(--err)' : 'var(--warn)', text: i.description, why: `Severity: ${i.severity}` })),
          ...rea.missingSteps.map((s) => ({ kind: 'MISSING STEP', color: 'var(--warn)', text: s, why: '' })),
          ...rea.assumptions.map((s) => ({ kind: 'ASSUMPTION', color: 'var(--warn)', text: s, why: '' })),
          ...rea.edgeCases.map((s) => ({ kind: 'EDGE CASE', color: 'var(--unver)', text: s, why: '' })),
        ],
      }
    : unavailable('The Reasoning Agent');

  const refinedTab = refined
    ? {
        markdown: refined.answer,
        changes: [{ kind: 'APPLIED', color: 'var(--run)', text: `${plural(run.refinements.filter((r) => !r.failed).length, 'refinement pass')} ran.`, why: 'Each pass revises the draft using only the reviewers’ findings.' }],
      }
    : { markdown: '_No refinement pass ran — either the limit was 0 or the reviewers raised nothing that required one._', changes: [] };

  const final = run.result
    ? {
        markdown: run.result.finalAnswer,
        changes: [
          { kind: 'SYNTHESIZED', color: 'var(--accent)', text: `${counts.supported} supported, ${plural(run.result.keyCorrections.length, 'correction')}, ${counts.unverified} unverified, ${plural(counts.contradicted, 'contradiction')}.`, why: 'The verification record ships attached to the answer.' },
          ...run.result.keyCorrections.map((c) => ({ kind: 'CORRECTED', color: 'var(--warn)', text: c, why: '' })),
        ],
      }
    : { markdown: '_The run has not produced a final answer._', changes: [] };

  return [
    { id: 'initial', label: 'Initial answer', dot: 'var(--fg3)', title: 'Initial answer', meta: `${run.agents.generator?.model || 'generator'}${secs(run.agents.generator)}`, ...initial },
    { id: 'verify', label: 'Verifier findings', dot: 'var(--ok)', title: 'Verifier findings', meta: `${run.agents.verifier?.model || 'verifier'}${secs(run.agents.verifier)}${run.evidence ? ` · ${plural(run.evidence.count || 0, 'source')} retrieved` : ''}`, ...verify },
    { id: 'reason', label: 'Reasoning critique', dot: 'var(--warn)', title: 'Reasoning critique', meta: `${run.agents.reasoner?.model || 'reasoner'}${secs(run.agents.reasoner)}`, ...reason },
    { id: 'refined', label: 'Refined', dot: 'var(--run)', title: 'Refined answer', meta: refined ? `pass ${refined.iteration}` : 'no passes', ...refinedTab },
    { id: 'final', label: 'Final answer', dot: 'var(--accent)', title: 'Final answer', meta: run.result?.durationMs ? `synthesized · ${(run.result.durationMs / 1000).toFixed(1)}s total` : 'synthesized', ...final },
  ];
}

export function relativeTime(date) {
  const d = new Date(date);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400 && d.getDate() === new Date().getDate()) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const isToday = (date) => new Date(date).toDateString() === new Date().toDateString();

export const DEPTH_LEVELS = ['fast', 'light', 'standard', 'thorough', 'exhaustive'];
export const DEPTH_LABEL = { fast: 'Fast', light: 'Light', standard: 'Standard', thorough: 'Thorough', exhaustive: 'Exhaustive' };
export const STYLES = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Exhaustive' },
];
export const DOMAINS = [
  { value: 'auto', label: 'Automatic' }, { value: 'general', label: 'General' }, { value: 'coding', label: 'Coding' },
  { value: 'education', label: 'Education' }, { value: 'research', label: 'Research' }, { value: 'technical', label: 'Technical' },
];
