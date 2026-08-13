'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import styles from './AuthPanel.module.css';

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset';
type Notice = { kind: 'ok' | 'err'; text: string };

const COPY: Record<
  Mode,
  { title: string; sub: string; swap?: [string, string]; swapTo?: Mode }
> = {
  signin: {
    title: 'Welcome back',
    sub: 'Sign in to keep your champion pool, draft history and saved matchups.',
    swap: ['New to Wild Rift Forge?', 'Create an account'],
    swapTo: 'signup',
  },
  signup: {
    title: 'Create your account',
    sub: 'Free while we are in beta. Save your champion pool and matchups across devices.',
    swap: ['Already have an account?', 'Sign in'],
    swapTo: 'signin',
  },
  forgot: {
    title: 'Reset your password',
    sub: 'Enter the email on your account and we will send a link to set a new password.',
    swap: ['Remembered it?', 'Sign in'],
    swapTo: 'signin',
  },
  sent: {
    title: 'Check your email',
    sub: 'We sent a reset link. Open it on this device to set a new password.',
    swap: ['Wrong address?', 'Use another'],
    swapTo: 'forgot',
  },
  reset: {
    title: 'Set a new password',
    sub: 'Pick something you have not used on Wild Rift Forge before.',
    swap: ['Changed your mind?', 'Back to sign in'],
    swapTo: 'signin',
  },
};

const SSO = [
  { name: 'Google', provider: 'google' as const, ini: 'G', bg: '#FFFFFF', fg: '#1A1A1A' },
  { name: 'Apple', provider: 'apple' as const, ini: 'A', bg: '#0B0A12', fg: '#fff' },
];

const REGIONS = ['NA', 'EUW', 'BR', 'KR', 'SEA'] as const;

const STATS = [
  { v: '1.4M', k: 'GAMES / WEEK' },
  { v: '22', k: 'CHAMPIONS' },
  { v: '6.2b', k: 'PATCH' },
] as const;

function passwordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: 'Too short', color: '#6e6a8c' };
  let level = 0;
  if (password.length >= 8) level += 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) level += 1;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) level += 1;
  if (level <= 1) return { level: Math.max(level, 1), label: 'Weak', color: '#e58b7b' };
  if (level === 2) return { level, label: 'Okay', color: '#f0a87b' };
  return { level: 3, label: 'Strong', color: '#8fedb8' };
}

function callbackUrl(next = '/') {
  const url = new URL('/auth/callback', window.location.origin);
  if (next !== '/') url.searchParams.set('next', next);
  return url.toString();
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'Email or password is incorrect.';
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with that email already exists. Sign in instead.';
  }
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'That sign-in method is not enabled yet. Use email, or try the other provider.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email from the link we sent, then sign in.';
  }
  if (lower.includes('password')) return message;
  return message;
}

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'reset' ? 'reset' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [riotId, setRiotId] = useState('');
  const [remember, setRemember] = useState(true);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('NA');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];
  const strength = useMemo(() => passwordStrength(password), [password]);
  const showSso = mode === 'signin' || mode === 'signup';
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) setNotice({ kind: 'err', text: friendlyAuthError(error) });
    if (searchParams.get('mode') === 'reset') setMode('reset');
  }, [searchParams]);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        return;
      }
      if (session && mode !== 'reset' && mode !== 'forgot' && mode !== 'sent') {
        router.replace('/');
        router.refresh();
      }
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user && mode !== 'reset') {
        router.replace('/');
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [configured, mode, router]);

  async function submit() {
    if (!configured) {
      setNotice({ kind: 'err', text: 'Auth is not configured. Add Supabase keys to apps/web/.env.local.' });
      return;
    }

    const supabase = createClient();
    setBusy(true);
    setNotice(null);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) {
          setNotice({ kind: 'err', text: 'Enter the email on your account.' });
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: callbackUrl('/auth?mode=reset'),
        });
        if (error) {
          setNotice({ kind: 'err', text: friendlyAuthError(error.message) });
          return;
        }
        setMode('sent');
        return;
      }

      if (mode === 'reset') {
        if (password.length < 8) {
          setNotice({ kind: 'err', text: 'Use at least 8 characters.' });
          return;
        }
        if (password !== confirmPassword) {
          setNotice({ kind: 'err', text: 'Those passwords do not match.' });
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setNotice({ kind: 'err', text: friendlyAuthError(error.message) });
          return;
        }
        setPassword('');
        setConfirmPassword('');
        setNotice({ kind: 'ok', text: 'Password updated. You are signed in.' });
        router.replace('/');
        router.refresh();
        return;
      }

      if (!email.trim() || !password) {
        setNotice({ kind: 'err', text: 'Enter your email and password.' });
        return;
      }

      if (mode === 'signup') {
        if (password.length < 8) {
          setNotice({ kind: 'err', text: 'Use at least 8 characters.' });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callbackUrl(),
            data: {
              region,
              riot_id: riotId.trim() || null,
            },
          },
        });
        if (error) {
          setNotice({ kind: 'err', text: friendlyAuthError(error.message) });
          return;
        }
        if (!data.session) {
          setNotice({
            kind: 'ok',
            text: 'Check your email to confirm the account, then sign in.',
          });
          return;
        }
        router.replace('/');
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setNotice({ kind: 'err', text: friendlyAuthError(error.message) });
        return;
      }
      router.replace('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function continueWith(provider: 'google' | 'apple') {
    if (!configured) {
      setNotice({ kind: 'err', text: 'Auth is not configured. Add Supabase keys to apps/web/.env.local.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setBusy(false);
      setNotice({ kind: 'err', text: friendlyAuthError(error.message) });
    }
  }

  return (
    <div className={styles.split}>
      <section className={styles.formPane}>
        <Link href="/" className={styles.logoLink} aria-label="Wild Rift Forge home">
          <Image
            src="/logo-wr-forge.png"
            alt="Wild Rift Forge"
            width={250}
            height={75}
            priority
            className={styles.logo}
          />
        </Link>

        <div className={styles.formBody}>
          {notice ? (
            <div
              className={notice.kind === 'err' ? styles.noticeError : styles.notice}
              role={notice.kind === 'err' ? 'alert' : 'status'}
            >
              <span className={styles.noticeDot} />
              <span>{notice.text}</span>
            </div>
          ) : null}

          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.sub}>{copy.sub}</p>

          {mode === 'signin' ? (
            <form
              className={styles.fields}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>EMAIL</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabelRow}>
                  <span className={styles.fieldLabel}>PASSWORD</span>
                  <button type="button" className={styles.link} onClick={() => setMode('forgot')}>
                    Forgot password?
                  </button>
                </span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button
                type="button"
                className={styles.remember}
                onClick={() => setRemember((v) => !v)}
              >
                <span
                  className={styles.checkbox}
                  style={{
                    background: remember ? 'var(--accent)' : 'transparent',
                    borderColor: remember ? 'var(--accent)' : 'rgba(255,255,255,.2)',
                  }}
                  aria-hidden
                >
                  {remember ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4">
                      <path d="M4 12.5l5.2 5.2L20 7" />
                    </svg>
                  ) : null}
                </span>
                Keep me signed in on this device
              </button>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : null}

          {mode === 'signup' ? (
            <form
              className={styles.fields}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>EMAIL</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>RIOT ID</span>
                <input
                  className={styles.input}
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                  placeholder="Summoner#NA1"
                />
                <span className={styles.hint}>Used to pull your match history. You can add it later.</span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>PASSWORD</span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <span className={styles.strengthRow}>
                  <span className={styles.strengthBars}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={styles.strengthBar}
                        style={{
                          background: i < strength.level ? strength.color : 'rgba(255,255,255,.09)',
                        }}
                      />
                    ))}
                  </span>
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </span>
              </label>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>REGION</span>
                <div className={styles.regions}>
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={region === r ? styles.regionActive : styles.region}
                      onClick={() => setRegion(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
              <p className={styles.legal}>
                By creating an account you agree to the terms of service and privacy policy. Wild
                Rift Forge is not endorsed by Riot Games.
              </p>
            </form>
          ) : null}

          {mode === 'forgot' ? (
            <form
              className={styles.fields}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>EMAIL</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" className={styles.secondary} onClick={() => setMode('signin')}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'sent' ? (
            <div className={styles.fields}>
              <div className={styles.emailCard}>
                <div className={styles.emailIcon} aria-hidden>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9FCBE4" strokeWidth="1.9">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3.5 6.5L12 13l8.5-6.5" />
                  </svg>
                </div>
                <div>
                  <div className={styles.emailLabel}>{email || 'your email address'}</div>
                  <div className={styles.hint}>The link expires in about an hour.</div>
                </div>
              </div>
              <button type="button" className={styles.secondary} onClick={() => setMode('signin')}>
                Back to sign in
              </button>
              <p className={styles.swapInline}>
                Nothing arrived?{' '}
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setMode('forgot');
                    setNotice(null);
                  }}
                >
                  Send it again
                </button>
              </p>
            </div>
          ) : null}

          {mode === 'reset' ? (
            <form
              className={styles.fields}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>NEW PASSWORD</span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <span className={styles.strengthRow}>
                  <span className={styles.strengthBars}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={styles.strengthBar}
                        style={{
                          background: i < strength.level ? strength.color : 'rgba(255,255,255,.09)',
                        }}
                      />
                    ))}
                  </span>
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>CONFIRM PASSWORD</span>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat it"
                  autoComplete="new-password"
                  required
                />
              </label>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? 'Saving…' : 'Save and sign in'}
              </button>
            </form>
          ) : null}

          {showSso ? (
            <div className={styles.sso}>
              <div className={styles.ssoDivider}>
                <span />
                <span className={styles.ssoOr}>or continue with</span>
                <span />
              </div>
              <div className={styles.ssoGrid}>
                {SSO.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className={styles.ssoBtn}
                    disabled={busy}
                    onClick={() => void continueWith(p.provider)}
                  >
                    <span className={styles.ssoBadge} style={{ background: p.bg, color: p.fg }}>
                      {p.ini}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {copy.swap && copy.swapTo ? (
            <p className={styles.swap}>
              <span>{copy.swap[0]}</span>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setNotice(null);
                  setMode(copy.swapTo!);
                }}
              >
                {copy.swap[1]}
              </button>
            </p>
          ) : null}
        </div>

        <div className={styles.footer}>
          <span>Terms</span>
          <span>Privacy</span>
          <span>Support</span>
        </div>
      </section>

      <aside className={styles.artPane}>
        <Image
          src="/login-art.avif"
          alt="Wild Rift champions charging forward"
          fill
          className={styles.art}
          sizes="(max-width: 900px) 100vw, 50vw"
          quality={90}
          unoptimized
          priority
        />
        <div className={styles.artFade} aria-hidden />
        <div className={styles.artCopy}>
          <p className={styles.quote}>
            Fourteen thousand matchups, ranked every night on the games people actually played.
          </p>
          <div className={styles.stats}>
            {STATS.map((s) => (
              <div key={s.k}>
                <div className={styles.statValue}>{s.v}</div>
                <div className={styles.statLabel}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
