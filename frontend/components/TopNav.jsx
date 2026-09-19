'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { initials, useLogout, usePreferences, useSession } from '@/hooks/useAuth';
import { useTheme } from './ThemeProvider';
import { Logo } from './Logo';

const BOUNCE = '560ms cubic-bezier(.34,1.5,.5,1)';

export function TopNav() {
  return (
    <Suspense fallback={null}>
      <Nav />
    </Suspense>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: user } = useSession();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const prefs = usePreferences();

  // The account's saved theme wins once per sign-in; the toggle below keeps it in sync.
  const savedTheme = user?.preferences?.theme;
  useEffect(() => {
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, [user?.id, savedTheme, setTheme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) prefs.mutate({ theme: next });
  };
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const onScroll = () => setScrolled((window.scrollY || 0) > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => () => {
    if (pathname !== '/') return router.push(`/#${id}`);
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' });
    return undefined;
  };

  const workspaceHref = (extra = {}) => {
    const next = new URLSearchParams();
    const c = params.get('c');
    if (c) next.set('c', c);
    for (const [k, v] of Object.entries(extra)) next.set(k, v);
    const qs = next.toString();
    return `/workspace${qs ? `?${qs}` : ''}`;
  };

  const view = pathname === '/workspace' ? params.get('view') || 'app' : null;
  const links = user
    ? [
        { label: 'Workspace', go: () => router.push(workspaceHref()), active: view === 'app' },
        { label: 'Comparison', go: () => router.push(workspaceHref({ view: 'compare' })), active: view === 'compare' },
      ]
    : [
        { label: 'Overview', go: scrollTo('overview') },
        { label: 'Pipeline steps', go: scrollTo('steps') },
        { label: 'Transparency', go: scrollTo('transparency') },
      ];

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 60, display: 'flex', justifyContent: 'center',
        padding: scrolled ? '16px 16px 0' : '0px', pointerEvents: 'none', transition: `padding ${BOUNCE}`,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto', width: '100%', maxWidth: scrolled ? 1080 : '100%',
          border: `1px solid ${scrolled ? 'var(--line2)' : 'transparent'}`,
          borderRadius: scrolled ? 999 : 0,
          background: scrolled ? 'var(--gf)' : 'var(--g2)',
          backdropFilter: `blur(${scrolled ? 30 : 18}px) saturate(1.5)`,
          WebkitBackdropFilter: `blur(${scrolled ? 30 : 18}px) saturate(1.5)`,
          boxShadow: scrolled ? 'var(--sh),inset 0 1px 0 var(--hl)' : '0 1px 0 var(--line)',
          transition: `max-width ${BOUNCE},border-radius ${BOUNCE},box-shadow 420ms cubic-bezier(.2,.8,.2,1),background 320ms ease,border-color 320ms ease`,
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 10,
            padding: scrolled ? '8px 10px 8px 16px' : '14px 18px', transition: `padding ${BOUNCE}`,
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none', border: 0, background: 'transparent', color: 'var(--fg)', cursor: 'pointer', padding: 0 }}
            aria-label="SynapseAI home"
          >
            <Logo />
            <span className="disp" style={{ fontSize: 17, letterSpacing: '-.01em' }}>SynapseAI</span>
          </button>

          <nav style={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            {links.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={link.go}
                className="btn-ghost"
                aria-current={link.active ? 'page' : undefined}
                style={{ color: link.active ? 'var(--fg)' : 'var(--fg2)', padding: '8px 10px', borderRadius: 10, fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            {user === null ? (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="btn-accent lift bright"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 120, height: 40, padding: '0 22px', borderRadius: 999, fontSize: 14.5, whiteSpace: 'nowrap' }}
              >
                Sign in
              </button>
            ) : null}
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="btn-ghost"
                  style={{ padding: '9px 14px', borderRadius: 999, fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => router.push(workspaceHref({ focus: '1' }))}
                  className="btn-accent lift bright"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 140, height: 40, padding: '0 20px', borderRadius: 999, fontSize: 14.5, whiteSpace: 'nowrap' }}
                >
                  Ask a question
                </button>
                <button
                  type="button"
                  title="Profile and settings"
                  aria-label="Profile and settings"
                  onClick={() => router.push(workspaceHref({ settings: '1' }))}
                  className="lift"
                  style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--gac)', color: 'var(--fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--spring)' }}
                >
                  {initials(user.name)}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="lift to-fg"
              style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--g1)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--spring),color var(--ease)', boxShadow: 'inset 0 1px 0 var(--hl)' }}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
