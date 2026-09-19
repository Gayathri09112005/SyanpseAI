'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useAuth';
import { useRun } from '@/hooks/useRun';
import { conversations as conversationApi, system } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { Composer } from './Composer';
import { RunSettings } from './RunSettings';
import { AgentPanel, EndedState, IdleState, RunningState } from './AgentPanel';
import { FinalAnswer } from './FinalAnswer';
import { Compare } from './Compare';
import { SettingsModal } from './SettingsModal';

const fromPrefs = (p = {}) => ({
  answerStyle: p.answerStyle || 'balanced',
  reasoningDepth: p.reasoningDepth || 'standard',
  domain: p.domain || 'auto',
  evidenceRetrieval: p.evidenceRetrieval ?? false,
  minRefinementIterations: p.minRefinementIterations ?? 0,
  maxRefinementIterations: p.maxRefinementIterations ?? 2,
  streamPartialAnswers: p.streamPartialAnswers ?? false,
});

export function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: user } = useSession();

  const conversationId = params.get('c');
  const view = params.get('view') === 'compare' ? 'compare' : 'app';
  const settingsOpen = params.get('settings') === '1';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState(() => fromPrefs(user?.preferences));
  const [question, setQuestion] = useState('');
  const [expanded, setExpanded] = useState({});

  const setParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) (v == null ? next.delete(k) : next.set(k, v));
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, []);
  useEffect(() => {
    if (params.get('history') === '1') {
      setSidebarOpen(true);
      setParams({ history: null });
    }
  }, [params, setParams]);
  useEffect(() => setSettings(fromPrefs(user?.preferences)), [user?.preferences]);

  const { data: status } = useQuery({ queryKey: ['providers'], queryFn: system.providers, staleTime: 30_000 });
  const providers = status?.providers;
  const liveCount = providers?.filter((p) => p.mode === 'live').length ?? 0;
  const providersLine = !providers ? 'checking providers…' : liveCount ? `${liveCount} provider${liveCount === 1 ? '' : 's'} online` : 'mock mode · no provider keys';

  // Any finished run (completed, failed or cancelled) changes the sidebar's status line.
  const run = useRun({
    onEnd: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
  const busy = ['starting', 'running'].includes(run.status);

  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationApi.get(conversationId),
    enabled: Boolean(conversationId),
  });

  // Reopening from history (or a shared URL) restores that conversation's latest run.
  const lastRun = conversation?.runs?.at(-1);
  useEffect(() => {
    if (!lastRun || busy || lastRun.id === run.runId) return;
    setQuestion(lastRun.question);
    setExpanded({});
    run.hydrate(lastRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRun?.id]);

  const ask = async (text) => {
    setQuestion(text);
    setExpanded({});
    const { streamPartialAnswers, ...runSettings } = settings;
    try {
      const created =
        run.status === 'completed' && run.runId && conversationId
          ? await run.start({ runId: run.runId, question: text, settings: runSettings }, 'follow-up')
          : await run.start({ question: text, conversationId: conversationId || undefined, settings: runSettings });
      if (created.conversationId !== conversationId) setParams({ c: created.conversationId });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      /* surfaced through run.error */
    }
  };

  const regenerate = async () => {
    setExpanded({});
    try {
      await run.start({ runId: run.runId }, 'regenerate');
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      /* surfaced through run.error */
    }
  };

  const newConversation = () => {
    run.reset();
    setQuestion('');
    setExpanded({});
    setParams({ c: null, view: null });
  };

  const showAgent = (key) => {
    setExpanded((e) => ({ ...e, [key]: true }));
    requestAnimationFrame(() => document.getElementById(`agent-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const body = useMemo(() => {
    if (run.status === 'idle') return <IdleState />;
    if (busy) return <RunningState run={run} showDraft={settings.streamPartialAnswers} />;
    if (run.result) {
      return (
        <FinalAnswer
          run={run}
          question={question}
          busy={busy}
          onRegenerate={regenerate}
          onCompare={() => setParams({ view: 'compare' })}
          onShowAgent={showAgent}
        />
      );
    }
    return <EndedState run={run} onRetry={question ? () => ask(question) : null} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, busy, settings.streamPartialAnswers, question]);

  return (
    <>
      {view === 'compare' ? (
        <Compare run={run} conversationId={conversationId} onBack={() => setParams({ view: null })} />
      ) : (
        <div className="app-shell" style={{ maxWidth: 1440, margin: '0 auto', padding: '10px 20px 0', display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0 }}>
          {sidebarOpen ? (
            <div className="only-mobile" onClick={() => setSidebarOpen(false)} aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 74, background: 'rgba(6,8,12,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          ) : null}
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
            activeId={conversationId}
            onSelect={(id) => {
              if (window.innerWidth < 720) setSidebarOpen(false);
              if (id !== conversationId) setParams({ c: id });
            }}
            onNew={newConversation}
            onOpenSettings={() => setParams({ settings: '1' })}
          />

          <main style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, paddingBottom: 40 }}>
            {!sidebarOpen ? (
              <button type="button" onClick={() => setSidebarOpen(true)} className="btn-glass lift1 only-mobile" style={{ justifySelf: 'start', alignItems: 'center', gap: 8, minHeight: 40, padding: '8px 14px', borderRadius: 4, fontSize: 14 }}>
                ☰ Conversations
              </button>
            ) : null}
            {question && run.status !== 'idle' ? (
              <div className="glass2" style={{ borderRadius: 5, padding: '14px 20px' }}>
                <div className="mono-label">QUESTION</div>
                <div style={{ fontSize: 16.5, marginTop: 6, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{question}</div>
              </div>
            ) : null}
            <Composer
              style={settings.answerStyle}
              onStyle={(v) => setSettings((s) => ({ ...s, answerStyle: v }))}
              onRun={ask}
              onCancel={run.cancel}
              busy={busy}
              providersLine={providersLine}
              isFollowUp={Boolean(run.result && conversationId)}
              focusSignal={params.get('focus')}
            />
            <RunSettings settings={settings} onChange={setSettings} />
            <AgentPanel run={run} providers={providers} expanded={expanded} onToggle={(k) => setExpanded((e) => ({ ...e, [k]: !e[k] }))} />
            {body}
          </main>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setParams({ settings: null })} user={user} providers={providers} />
    </>
  );
}
