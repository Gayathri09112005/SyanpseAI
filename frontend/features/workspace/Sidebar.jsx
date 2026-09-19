'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversations as api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { isToday, relativeTime } from './derive';

export function Sidebar({ open, onToggle, activeId, onSelect, onNew, onOpenSettings }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['conversations', query],
    queryFn: () => api.list(query ? { q: query, limit: 50 } : { limit: 50 }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['conversations'] });

  const rename = useMutation({
    mutationFn: ({ id, title }) => api.rename(id, title),
    onSuccess: () => { setEditing(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: (_r, id) => {
      setDeleting(null);
      refresh();
      if (id === activeId) onNew();
    },
  });

  const items = data?.items || [];
  const groups = [
    ['TODAY', items.filter((c) => isToday(c.updatedAt))],
    ['EARLIER', items.filter((c) => !isToday(c.updatedAt))],
  ].filter(([, list]) => list.length);

  return (
    <aside
      className={`app-sidebar${open ? ' open' : ''}`}
      style={{
        width: open ? 272 : 64, flex: 'none', position: 'sticky', top: 88, border: '1px solid var(--line)', background: 'var(--g1)',
        backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', borderRadius: 5,
        boxShadow: 'var(--sh-sm),inset 0 1px 0 var(--hl)', overflow: 'hidden', transition: 'width var(--spring)',
      }}
      aria-label="Conversations"
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onToggle}
            title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={open}
            className="lift1 to-fg icon-btn"
            style={{ width: 36, height: 36, flex: 'none', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g2)', color: 'var(--fg2)', cursor: 'pointer', boxShadow: 'inset 0 1px 0 var(--hl)', transition: 'transform var(--spring)' }}
          >
            ☰
          </button>
          {open ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <button type="button" onClick={onNew} className="btn-accent flat lift1 bright" style={{ width: '100%', padding: '9px 14px', borderRadius: 4, fontSize: 14 }}>
                ＋ New conversation
              </button>
            </div>
          ) : null}
        </div>
        {open ? (
          <div className="focus-accent" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--gin)', boxShadow: 'inset 0 1px 0 var(--hl)' }}>
            <span style={{ color: 'var(--fg3)', fontSize: 13 }} aria-hidden>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--fg)', fontSize: 14, outline: 'none' }}
            />
          </div>
        ) : null}
      </div>

      {open ? (
        <div style={{ padding: '0 14px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
          {isPending ? <div className="meta" style={{ padding: '0 4px' }}>Loading…</div> : null}
          {isError ? <div style={{ fontSize: 13, color: 'var(--err)', padding: '0 4px' }}>Could not load conversations.</div> : null}
          {!isPending && !items.length ? (
            <div style={{ fontSize: 13, color: 'var(--fg3)', padding: '0 4px' }}>{query ? 'No matches.' : 'No conversations yet.'}</div>
          ) : null}

          {groups.map(([label, list]) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.1em', color: 'var(--fg3)', padding: '0 4px 8px' }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 4 }}>
                {list.map((c) => {
                  const active = c.id === activeId;
                  if (editing === c.id) {
                    return (
                      <form
                        key={c.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const title = new FormData(e.currentTarget).get('title').toString().trim();
                          if (title) rename.mutate({ id: c.id, title });
                        }}
                        style={{ padding: '6px', borderRadius: 4, border: '1px solid var(--accent-line)', background: 'var(--gac)', display: 'flex', gap: 6 }}
                      >
                        <input
                          name="title"
                          defaultValue={c.title}
                          maxLength={160}
                          autoFocus
                          aria-label="Conversation title"
                          onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                          style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--line2)', background: 'var(--gin)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}
                        />
                        <button type="submit" aria-label="Save title" className="btn-ghost" style={{ borderRadius: 4, padding: '0 8px' }}>✓</button>
                      </form>
                    );
                  }
                  return (
                    <div
                      key={c.id}
                      className={active ? '' : 'hover-g2'}
                      style={{ position: 'relative', borderRadius: 4, border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`, background: active ? 'var(--gac)' : undefined }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        aria-current={active ? 'true' : undefined}
                        className="conv-title"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 56px 10px 12px', border: 0, background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: 14, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
                          {c.lastRun?.note || 'no runs yet'} · {relativeTime(c.updatedAt)}
                        </div>
                      </button>
                      <div style={{ position: 'absolute', right: 6, top: 8, display: 'flex', gap: 2 }}>
                        <button type="button" onClick={() => setEditing(c.id)} aria-label={`Rename ${c.title}`} title="Rename" className="btn-ghost icon-btn" style={{ borderRadius: 4, padding: '3px 6px', fontSize: 12 }}>✎</button>
                        <button type="button" onClick={() => setDeleting(c)} aria-label={`Delete ${c.title}`} title="Delete" className="btn-ghost icon-btn" style={{ borderRadius: 4, padding: '3px 6px', fontSize: 12 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onOpenSettings}
            className="lift1 to-fg"
            style={{ marginTop: 2, padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--g2)', color: 'var(--fg2)', fontSize: 13.5, textAlign: 'left', cursor: 'pointer', transition: 'transform var(--spring),color var(--ease)' }}
          >
            ⚙ Settings &amp; providers
          </button>
        </div>
      ) : null}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this conversation?"
        subtitle={deleting?.title}
        width={460}
        footer={
          <>
            <button type="button" onClick={() => setDeleting(null)} className="btn-glass lift" style={{ padding: '11px 18px', borderRadius: 12, fontSize: 14 }}>Cancel</button>
            <button type="button" onClick={() => remove.mutate(deleting.id)} disabled={remove.isPending} className="btn-danger lift bright" style={{ padding: '11px 20px', borderRadius: 12, fontSize: 14 }}>
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.5 }}>
          The conversation and every reasoning run inside it are removed permanently.
        </div>
      </Modal>
    </aside>
  );
}
