'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/Modal';
import { Slider, Switch } from '@/components/Controls';
import { useTheme } from '@/components/ThemeProvider';
import { usePreferences } from '@/hooks/useAuth';
import { auth } from '@/lib/api';
import { DEPTH_LABEL, DEPTH_LEVELS, DOMAINS, STYLES } from './derive';

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderRadius: 'var(--r-m)', border: '1px solid var(--line)', background: 'var(--g1)', boxShadow: 'inset 0 1px 0 var(--hl)', flexWrap: 'wrap' };
const block = { ...row, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', justifyContent: 'stretch', alignItems: 'stretch', gap: 10 };

function Pills({ options, value, onChange, label }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{ padding: '7px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`, background: on ? 'var(--accent-soft)' : 'var(--g2)', color: on ? 'var(--accent)' : 'var(--fg2)', fontSize: 13, cursor: 'pointer' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsModal({ open, onClose, user, providers }) {
  const { theme, setTheme } = useTheme();
  const save = usePreferences();
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (open && user) {
      const p = user.preferences || {};
      setDraft({
        answerStyle: p.answerStyle || 'balanced',
        reasoningDepth: p.reasoningDepth || 'standard',
        domain: p.domain || 'auto',
        storeAgentTranscripts: p.storeAgentTranscripts ?? true,
      });
      setConfirmDelete(false);
      setDeleteError(null);
    }
  }, [open, user]);

  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const onSave = async () => {
    await save.mutateAsync({ ...draft, theme });
    onClose();
  };

  const onDelete = async () => {
    try {
      await auth.deleteAccount();
      qc.clear();
      qc.setQueryData(['session'], null);
      router.push('/');
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      subtitle="Defaults for new conversations."
      footer={
        <>
          {save.isError ? <span style={{ fontSize: 13, color: 'var(--err)', alignSelf: 'center', marginRight: 'auto' }}>{save.error.message}</span> : null}
          <button type="button" onClick={onClose} className="btn-glass lift" style={{ padding: '11px 18px', borderRadius: 12, fontSize: 14 }}>Cancel</button>
          <button type="button" onClick={onSave} disabled={save.isPending} className="btn-accent lift bright" style={{ padding: '11px 20px', borderRadius: 12, fontSize: 14 }}>
            {save.isPending ? 'Saving…' : 'Save defaults'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={row}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Theme</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>Glass tint follows the system palette</div>
          </div>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-glass lift" style={{ padding: '9px 16px', borderRadius: 11, fontSize: 13.5, background: 'var(--g2)' }}>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Default answer style</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>Applied to every new question</div>
          </div>
          <Pills label="Default answer style" options={STYLES} value={draft.answerStyle} onChange={(v) => set({ answerStyle: v })} />
        </div>

        <div style={block}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Reasoning depth</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent)' }}>{DEPTH_LABEL[draft.reasoningDepth]}</div>
          </div>
          <Slider
            label="Default reasoning depth"
            value={DEPTH_LEVELS.indexOf(draft.reasoningDepth) + 1}
            min={1}
            max={5}
            valueText={DEPTH_LABEL[draft.reasoningDepth]}
            onChange={(v) => set({ reasoningDepth: DEPTH_LEVELS[v - 1] })}
          />
        </div>

        <div style={block}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Domain</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>Tunes vocabulary and depth; Automatic infers it from the question</div>
          </div>
          <Pills label="Default domain" options={DOMAINS} value={draft.domain} onChange={(v) => set({ domain: v })} />
        </div>

        <div style={{ ...block, gap: 12 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Providers</div>
          {providers?.length ? providers.map((p) => {
            const live = p.mode === 'live';
            const c = live ? 'var(--ok)' : 'var(--warn)';
            return (
              <div key={p.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13.5, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg2)', overflowWrap: 'anywhere' }}>{p.provider} / {p.model}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: c }}>
                  <span className="dot" style={{ background: c }} />{live ? 'Configured' : 'Mock — no API key'}
                </span>
              </div>
            );
          }) : <div style={{ fontSize: 13.5, color: 'var(--fg3)' }}>Provider status unavailable.</div>}
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Retain transcripts</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>Off keeps only the final answer; agent transcripts are discarded</div>
          </div>
          <Switch label="Retain transcripts" checked={draft.storeAgentTranscripts} onChange={(v) => set({ storeAgentTranscripts: v })} />
        </div>

        <div style={{ ...row, borderColor: confirmDelete ? 'var(--err)' : 'var(--line)' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Delete account</div>
            <div style={{ fontSize: 13, color: 'var(--fg3)' }}>
              {confirmDelete ? 'This erases every conversation and run immediately. There is no recovery.' : 'Removes your account and all of its data'}
            </div>
            {deleteError ? <div role="alert" style={{ fontSize: 13, color: 'var(--err)' }}>{deleteError}</div> : null}
          </div>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-glass lift" style={{ padding: '9px 14px', borderRadius: 11, fontSize: 13.5 }}>Keep</button>
              <button type="button" onClick={onDelete} className="btn-danger lift bright" style={{ padding: '9px 14px', borderRadius: 11, fontSize: 13.5 }}>Delete everything</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger lift bright" style={{ padding: '9px 14px', borderRadius: 11, fontSize: 13.5 }}>Delete</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
