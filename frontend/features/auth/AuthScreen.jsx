'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useRegister } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

const inputStyle = {
  padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--gin)',
  color: 'var(--fg)', fontSize: 15, outline: 'none', boxShadow: 'inset 0 1px 0 var(--hl)',
};

function Field({ label, error, children }) {
  return (
    <label style={{ display: 'grid', gap: 7, fontSize: 13.5, color: 'var(--fg2)' }}>
      {label}
      {children}
      {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--err)' }}>{error}</span> : null}
    </label>
  );
}

export function AuthScreen({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [remember, setRemember] = useState(true);
  const isRegister = mode === 'register';
  const login = useLogin();
  const register = useRegister();

  const form = useForm({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const switchMode = () => {
    form.clearErrors();
    setMode(isRegister ? 'login' : 'register');
    window.history.replaceState(null, '', isRegister ? '/login' : '/register');
  };

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    try {
      if (isRegister) await register.mutateAsync({ name, email, password });
      else await login.mutateAsync({ email, password, remember });
    } catch (err) {
      for (const f of err.fields || []) form.setError(f.path, { message: f.message });
      if (!err.fields?.length) form.setError('root', { message: err.message });
    }
  });

  return (
    <div className="page page-top" style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 24, alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <h1 className="disp" style={{ fontSize: 'clamp(30px,4vw,46px)', letterSpacing: '-.03em', margin: 0, lineHeight: 1.05 }}>
          Answers you can hand to someone else.
        </h1>
        <p style={{ margin: 0, color: 'var(--fg2)', fontSize: 16.5, lineHeight: 1.6, maxWidth: '44ch' }}>
          Sign in to keep your verification records, provider routing and retention settings across devices.
        </p>
        <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          <div className="meta">HTTP-only session cookie · provider keys never reach the browser</div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="panel-lg"
        style={{ border: '1px solid var(--line)', background: 'var(--g1)', backdropFilter: 'blur(26px) saturate(1.4)', WebkitBackdropFilter: 'blur(26px) saturate(1.4)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh),inset 0 1px 0 var(--hl)', padding: 28, display: 'grid', gap: 14 }}
      >
        <div className="disp" style={{ fontSize: 22, letterSpacing: '-.02em' }}>{isRegister ? 'Create account' : 'Sign in'}</div>

        {isRegister ? (
          <Field label="Name" error={errors.name?.message}>
            <input className="focus-accent" style={inputStyle} autoComplete="name" placeholder="Your name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
          </Field>
        ) : null}
        <Field label="Work email" error={errors.email?.message}>
          <input className="focus-accent" style={inputStyle} type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input className="focus-accent" style={inputStyle} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="••••••••••" aria-invalid={Boolean(errors.password)} {...form.register('password')} />
        </Field>

        {!isRegister ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--fg2)' }}>
            <button
              type="button"
              role="checkbox"
              aria-checked={remember}
              onClick={() => setRemember((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', border: 0, background: 'transparent', color: 'inherit', fontSize: 'inherit', padding: 0 }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 7, border: `1px solid ${remember ? 'var(--accent-line)' : 'var(--line2)'}`, background: remember ? 'var(--accent)' : 'var(--gin)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)', fontSize: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)', transition: 'background var(--ease)' }}>
                {remember ? '✓' : ''}
              </span>
              Keep me signed in
            </button>
          </div>
        ) : null}

        {errors.root ? <div role="alert" style={{ fontSize: 13.5, color: 'var(--err)' }}>{errors.root.message}</div> : null}

        <button type="submit" disabled={isSubmitting} className="btn-accent lift bright" style={{ marginTop: 4, padding: 13, borderRadius: 13, fontSize: 15 }}>
          {isSubmitting ? 'Working…' : isRegister ? 'Create account' : 'Continue'}
        </button>
        <button type="button" onClick={switchMode} className="lift" style={{ padding: 12, borderRadius: 13, border: '1px solid var(--line2)', background: 'var(--g2)', color: 'var(--fg)', fontSize: 14.5, cursor: 'pointer', boxShadow: 'inset 0 1px 0 var(--hl)', transition: 'transform var(--spring)' }}>
          {isRegister ? 'I already have an account' : 'Create an account'}
        </button>
        <div style={{ fontSize: 12.5, color: 'var(--fg3)', textAlign: 'center', lineHeight: 1.5 }}>
          Your questions are sent to the configured AI providers. You can delete any conversation, or your account, at any time.
        </div>
      </form>
    </div>
  );
}
