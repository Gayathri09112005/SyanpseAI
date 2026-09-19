'use client';

import { RangeSlider, Slider, Switch } from '@/components/Controls';
import { DEPTH_LABEL, DEPTH_LEVELS } from './derive';

function Head({ title, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent)' }}>{value}</div>
    </div>
  );
}

const Ends = ({ left, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg3)' }}>
    <span>{left}</span><span>{right}</span>
  </div>
);

function ToggleRow({ title, sub, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--fg3)' }}>{sub}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** Per-run settings. They start from the saved defaults; changing them here does not overwrite the defaults. */
export function RunSettings({ settings, onChange }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const depthIndex = DEPTH_LEVELS.indexOf(settings.reasoningDepth) + 1 || 3;

  return (
    <section className="glass2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, borderRadius: 5, padding: 20 }}>
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <Head title="Reasoning depth" value={DEPTH_LABEL[settings.reasoningDepth]} />
        <Slider
          label="Reasoning depth"
          value={depthIndex}
          min={1}
          max={5}
          valueText={DEPTH_LABEL[settings.reasoningDepth]}
          onChange={(v) => set({ reasoningDepth: DEPTH_LEVELS[v - 1] })}
        />
        <Ends left="Fast" right="Exhaustive" />
      </div>

      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <Head title="Refinement passes" value={`${settings.minRefinementIterations}–${settings.maxRefinementIterations}`} />
        <RangeSlider
          label="Refinement passes"
          lo={settings.minRefinementIterations}
          hi={settings.maxRefinementIterations}
          min={0}
          max={8}
          onChange={([lo, hi]) => set({ minRefinementIterations: lo, maxRefinementIterations: hi })}
        />
        <Ends left="0" right="8 passes" />
      </div>

      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <ToggleRow
          title="Evidence retrieval"
          sub="Verifier may search sources"
          checked={settings.evidenceRetrieval}
          onChange={(v) => set({ evidenceRetrieval: v })}
        />
        <ToggleRow
          title="Stream partial answers"
          sub="Show the draft before verification"
          checked={settings.streamPartialAnswers}
          onChange={(v) => set({ streamPartialAnswers: v })}
        />
      </div>
    </section>
  );
}
