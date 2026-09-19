'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { initials, useLogout, usePreferences, useSession } from '@/hooks/useAuth';
import { useHydrated } from '@/hooks/useHydrated';
import { useTheme } from './ThemeProvider';
import { Logo } from './Logo';

const BOUNCE = '560ms cubic-bezier(.34,1.5,.5,1)';
// Bar at rest: 14+40+14 + 2px border = 70. Pill: 12 top gap + 8+40+8 + 2 = 70. Same height, no layout shift.
const NAV_HEIGHT = 70;
// Half the pill's height (58px): fully round ends, and a radius that animates proportionally.
const PILL_RADIUS = 29;
// Framer equivalents of the design's bouncy curve: low damping = visible overshoot.
const PANEL_SPRING = { type: 'spring', stiffness: 520, damping: 19, mass: 0.8 };
const ITEM_SPRING = { type: 'spring', stiffness: 600, damping: 22 };

export function TopNav() {
  return (
    <Suspense fallback={null}>
      <Nav />
    </Suspense>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hydrated = useHydrated();
  const { data: sessionUser } = useSession();
  // undefined = unknown yet (server render, hydration, loading): render no session-specific UI.
  const user = hydrated ? sessionUser : undefined;
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const prefs = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The account's saved theme wins once per sign-in; the toggle keeps it in sync.
  const savedTheme = user?.preferences?.theme;
  useEffect(() => {
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, [user?.id, savedTheme, setTheme]);

  useEffect(() => {
    // Hysteresis: become a pill past 28px, but only return to a bar above 8px. A single threshold
    // lets the morph itself nudge the scroll position back across the line and flicker.
    const onScroll = () => {
      const y = window.scrollY || 0;
      setScrolled((was) => (was ? y > 8 : y > 28));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes the mobile menu.
  const paramsKey = params.toString();
  useEffect(() => setMenuOpen(false), [pathname, paramsKey]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) prefs.mutate({ theme: next });
  };

  const scrollTo = (id) => () => {
    setMenuOpen(false);
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
  const go = (href) => () => {
    setMenuOpen(false);
    router.push(href);
  };

  const view = pathname === '/workspace' ? params.get('view') || 'app' : null;
  const links = user === undefined
    ? []
    : user
    ? [
        { label: 'Workspace', go: go(workspaceHref()), active: view === 'app' },
        { label: 'Comparison', go: go(workspaceHref({ view: 'compare' })), active: view === 'compare' },
      ]
    : [
        { label: 'Overview', go: scrollTo('overview') },
        { label: 'Pipeline steps', go: scrollTo('steps') },
        { label: 'Transparency', go: scrollTo('transparency') },
      ];

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      title="Toggle theme"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="lift to-fg"
      style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--g1)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--spring),color var(--ease)', boxShadow: 'inset 0 1px 0 var(--hl)', flex: 'none' }}
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );

  return (
    <div
      data-scrolled={scrolled ? 'true' : 'false'}
      style={{
        position: 'sticky', top: 0, zIndex: 60, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        // Fixed height in both states, so morphing never pushes the page content (no jump, no scroll-anchor feedback).
        height: NAV_HEIGHT, boxSizing: 'border-box',
        padding: scrolled ? '12px 16px 0' : '0px', pointerEvents: 'none', transition: `padding ${BOUNCE}`,
      }}
    >
      <div
        style={{
          // min(): on screens narrower than 1080px both states resolve to 100%, so the springy curve has no
          // px↔% gap to overshoot (a plain 1080px made phones shrink-then-expand when returning to the bar).
          position: 'relative', zIndex: 2, pointerEvents: 'auto', width: '100%', maxWidth: scrolled ? 'min(1080px, 100%)' : '100%',
          border: `1px solid ${scrolled ? 'var(--line2)' : 'transparent'}`,
          borderRadius: scrolled ? PILL_RADIUS : 0,
          background: scrolled ? 'var(--gf)' : 'var(--g2)',
          backdropFilter: `blur(${scrolled ? 30 : 18}px) saturate(1.5)`,
          WebkitBackdropFilter: `blur(${scrolled ? 30 : 18}px) saturate(1.5)`,
          boxShadow: scrolled ? 'var(--sh),inset 0 1px 0 var(--hl)' : '0 1px 0 var(--line)',
          // Width bounces (the design's spring); corners use the smooth curve so they round/square in step with it.
          transition: `max-width ${BOUNCE},border-radius 460ms cubic-bezier(.2,.8,.2,1),box-shadow 420ms cubic-bezier(.2,.8,.2,1),background 320ms ease,border-color 320ms ease`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: scrolled ? '8px 10px 8px 16px' : '14px 18px', transition: `padding ${BOUNCE}` }}>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none', border: 0, background: 'transparent', color: 'var(--fg)', cursor: 'pointer', padding: 0 }}
            aria-label="SynapseAI home"
          >
            <Logo />
            <span className="disp" style={{ fontSize: 17, letterSpacing: '-.01em' }}>SynapseAI</span>
          </button>

          {/* Desktop: the design's nav, unchanged */}
          <nav className="only-desktop" style={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
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
          <div className="only-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            {user === null ? (
              <button type="button" onClick={go('/login')} className="btn-accent lift bright" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 120, height: 40, padding: '0 22px', borderRadius: 999, fontSize: 14.5, whiteSpace: 'nowrap' }}>
                Sign in
              </button>
            ) : null}
            {user ? (
              <>
                <button type="button" onClick={() => logout.mutate()} className="btn-ghost" style={{ padding: '9px 14px', borderRadius: 999, fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Sign out
                </button>
                <button type="button" onClick={go(workspaceHref({ focus: '1' }))} className="btn-accent lift bright" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 140, height: 40, padding: '0 20px', borderRadius: 999, fontSize: 14.5, whiteSpace: 'nowrap' }}>
                  Ask a question
                </button>
                <button
                  type="button"
                  title="Profile and settings"
                  aria-label="Profile and settings"
                  onClick={go(workspaceHref({ settings: '1' }))}
                  className="lift"
                  style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--gac)', color: 'var(--fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--spring)' }}
                >
                  {initials(user.name)}
                </button>
              </>
            ) : null}
            {themeButton}
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="only-mobile" style={{ marginLeft: 'auto', alignItems: 'center', gap: 8 }}>
            {themeButton}
            <Hamburger open={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <MobileMenu
            key="menu"
            user={user}
            links={links}
            onClose={() => setMenuOpen(false)}
            onSignIn={go('/login')}
            onAsk={go(workspaceHref({ focus: '1' }))}
            onHistory={go(workspaceHref({ history: '1' }))}
            onSettings={go(workspaceHref({ settings: '1' }))}
            onSignOut={() => { setMenuOpen(false); logout.mutate(); }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Three bars that spring into an ✕, while the button itself rotates with a bouncy overshoot. */
function Hamburger({ open, onClick }) {
  const bar = { position: 'absolute', left: 11, width: 16, height: 2, borderRadius: 2, background: 'var(--fg)', transition: 'transform 520ms cubic-bezier(.34,1.56,.5,1), opacity 200ms ease' };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="mobile-menu"
      animate={{ rotate: open ? 90 : 0 }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 420, damping: 13 }}
      style={{ position: 'relative', width: 40, height: 40, flex: 'none', borderRadius: 999, border: `1px solid ${open ? 'var(--accent-line)' : 'var(--line)'}`, background: open ? 'var(--gac)' : 'var(--g1)', cursor: 'pointer', boxShadow: 'inset 0 1px 0 var(--hl)', padding: 0 }}
    >
      <span style={{ ...bar, top: 13, transform: open ? 'translateY(6px) rotate(45deg)' : 'none' }} />
      <span style={{ ...bar, top: 19, opacity: open ? 0 : 1, transform: open ? 'scaleX(.2)' : 'none' }} />
      <span style={{ ...bar, top: 25, transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
    </motion.button>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: ITEM_SPRING },
};

function MobileMenu({ user, links, onClose, onSignIn, onAsk, onHistory, onSettings, onSignOut }) {
  const firstRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => firstRef.current?.focus(), 150);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [onClose]);

  const row = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 48,
    padding: '0 16px', borderRadius: 14, border: '1px solid transparent', background: 'transparent',
    color: 'var(--fg)', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  };

  return (
    <>
      {/* Tap-outside scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'auto', background: 'rgba(6,8,12,.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        aria-hidden
      />
      <motion.nav
        id="mobile-menu"
        aria-label="Menu"
        initial={{ opacity: 0, y: -18, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95, transition: { duration: 0.16 } }}
        transition={PANEL_SPRING}
        style={{
          position: 'absolute', top: 'calc(100% + 10px)', left: 12, right: 12, zIndex: 1, pointerEvents: 'auto',
          transformOrigin: 'top right', border: '1px solid var(--line2)', background: 'var(--gf)',
          backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
          borderRadius: 24, boxShadow: 'var(--sh),inset 0 1px 0 var(--hl)', padding: 10,
        }}
      >
        {/* The panel bounces in first; options follow in a staggered cascade. */}
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { delayChildren: 0.12, staggerChildren: 0.05 } } }} style={{ display: 'grid', gap: 4 }}>
          {user ? (
            <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 12px', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--gac)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flex: 'none' }}>
                {initials(user.name)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                <span className="meta" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
              </span>
            </motion.div>
          ) : null}

          {links.map((link, i) => (
            <motion.button
              key={link.label}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              variants={itemVariants}
              whileTap={{ scale: 0.97 }}
              onClick={link.go}
              aria-current={link.active ? 'page' : undefined}
              style={{ ...row, ...(link.active ? { background: 'var(--gac)', borderColor: 'var(--accent-line)' } : {}) }}
            >
              {link.label}
              <span style={{ color: 'var(--fg3)' }} aria-hidden>→</span>
            </motion.button>
          ))}

          {user ? (
            <>
              <motion.button type="button" variants={itemVariants} whileTap={{ scale: 0.97 }} onClick={onHistory} style={row}>
                Conversations <span style={{ color: 'var(--fg3)' }} aria-hidden>☰</span>
              </motion.button>
              <motion.button type="button" variants={itemVariants} whileTap={{ scale: 0.97 }} onClick={onSettings} style={row}>
                Settings &amp; providers <span style={{ color: 'var(--fg3)' }} aria-hidden>⚙</span>
              </motion.button>
            </>
          ) : null}

          <motion.div variants={itemVariants} style={{ display: 'grid', gap: 8, paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--line)' }}>
            {user ? (
              <>
                <button type="button" onClick={onAsk} className="btn-accent" style={{ height: 48, borderRadius: 14, fontSize: 15.5 }}>Ask a question</button>
                <button type="button" onClick={onSignOut} className="btn-ghost" style={{ height: 44, borderRadius: 14, fontSize: 15 }}>Sign out</button>
              </>
            ) : user === null ? (
              <button type="button" onClick={onSignIn} className="btn-accent" style={{ height: 48, borderRadius: 14, fontSize: 15.5 }}>Sign in</button>
            ) : null}
          </motion.div>
        </motion.div>
      </motion.nav>
    </>
  );
}
