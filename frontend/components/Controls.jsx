'use client';

import { useRef } from 'react';

/** Design switch: 52×30 track, glass knob springs from 3px to 25px. */
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="switch"
      style={{
        border: `1px solid ${checked ? 'var(--accent-line)' : 'var(--line2)'}`,
        background: checked ? 'var(--accent)' : 'var(--gin)',
      }}
    >
      <span style={{ left: checked ? 25 : 3 }} />
    </button>
  );
}

const pct = (v, min, max) => `${((v - min) / (max - min)) * 100}%`;

/** Pointer drag over a track, snapping to integer steps — same maths as the design's drag(). */
function useTrackDrag(trackRef, min, max) {
  return (onValue) => (event) => {
    event.preventDefault();
    const rect = trackRef.current.getBoundingClientRect();
    const move = (ev) => {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      onValue(Math.round(min + p * (max - min)));
    };
    move(event);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

const stepKeys = (value, min, max, set) => (e) => {
  const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (delta) {
    e.preventDefault();
    set(Math.max(min, Math.min(max, value + delta)));
  } else if (e.key === 'Home') {
    e.preventDefault();
    set(min);
  } else if (e.key === 'End') {
    e.preventDefault();
    set(max);
  }
};

export function Slider({ value, min, max, onChange, label, valueText }) {
  const ref = useRef(null);
  const drag = useTrackDrag(ref, min, max);
  return (
    <div ref={ref} className="track" onPointerDown={drag(onChange)}>
      <div className="track-rail" />
      <div className="track-fill" style={{ left: 0, width: pct(value, min, max), borderRadius: 999 }} />
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onKeyDown={stepKeys(value, min, max, onChange)}
        className="thumb"
        style={{ left: pct(value, min, max) }}
      />
    </div>
  );
}

/** Two thumbs; the low thumb can never pass the high one (design: lo ≤ hi − 1 while dragging). */
export function RangeSlider({ lo, hi, min, max, onChange, label }) {
  const ref = useRef(null);
  const drag = useTrackDrag(ref, min, max);
  const setLo = (v) => onChange([Math.min(v, hi), hi]);
  const setHi = (v) => onChange([lo, Math.max(v, lo)]);
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(e);
  };
  // Clicking the rail moves whichever thumb is nearer.
  const railDown = drag((v) => (Math.abs(v - lo) <= Math.abs(v - hi) ? setLo(v) : setHi(v)));

  return (
    <div ref={ref} className="track" onPointerDown={railDown}>
      <div className="track-rail" />
      <div className="track-fill" style={{ left: pct(lo, min, max), width: `${((hi - lo) / (max - min)) * 100}%` }} />
      {[
        ['Minimum', lo, setLo],
        ['Maximum', hi, setHi],
      ].map(([which, value, set]) => (
        <button
          key={which}
          type="button"
          role="slider"
          aria-label={`${label}: ${which.toLowerCase()}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onPointerDown={stop(drag(set))}
          onKeyDown={stepKeys(value, min, max, set)}
          className="thumb"
          style={{ left: pct(value, min, max) }}
        />
      ))}
    </div>
  );
}

export function StatusDot({ color, spin }) {
  return <span className="dot" style={{ background: color, animation: spin ? 'spin 1.1s linear infinite' : 'none' }} />;
}
