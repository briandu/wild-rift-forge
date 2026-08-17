'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { formatSnapshotDate } from '@/lib/placements';
import { loginHref, safeNextPath, type AuthMode } from '@/lib/auth-next';
import { clientAuthCallbackUrl } from '@/lib/supabase/site-url';
import { Spinner } from './LoadState';
import styles from './AuthPanel.module.css';

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset';
type Notice = { kind: 'ok' | 'err'; text: string };

function modeFromSearch(value: string | null): Mode | null {
  if (value === 'signin' || value === 'signup' || value === 'forgot' || value === 'reset') {
    return value;
  }
  return null;
}

const COPY: Record<Mode, { title: string; sub: string; swap?: [string, string]; swapTo?: Mode }> = {
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

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width="20" height="20">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="#fff">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function RiotMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="24" height="24">
      <rect width="24" height="24" rx="5.4" fill="#ED1B2C" />
      <g fill="#fff" transform="translate(12 12) scale(0.068) translate(-955.335 -540.001)">
        <path d="M966.033 458.247 867.265 503.985 891.874 597.641 910.604 595.341 905.453 536.457 911.608 533.717 922.222 593.914 954.235 589.984 948.549 524.986 954.634 522.276 966.311 588.501 998.695 584.525 992.462 513.277 998.622 510.534 1011.394 582.965 1043.406 579.035 1043.406 477.625Z" />
        <path d="M968.355 600.294 969.981 609.514 1043.406 621.755 1043.406 591.079 968.39 600.29Z" />
      </g>
    </svg>
  );
}

type SsoProvider = 'riot' | 'google' | 'apple';

const SSO: {
  name: string;
  provider: SsoProvider;
  Icon: () => ReactElement;
  appleOnly?: boolean;
}[] = [
  { name: 'Google', provider: 'google', Icon: GoogleMark },
  { name: 'Riot Games', provider: 'riot', Icon: RiotMark },
  { name: 'Apple', provider: 'apple', Icon: AppleMark, appleOnly: true },
];

function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return /Mac/.test(navigator.platform) || /Macintosh/.test(ua);
}

const REGIONS = ['NA', 'EUW', 'BR', 'KR', 'SEA'] as const;

function liveStats(
  patchVersion: string | null,
  championCount: number,
  snapshotDate: string | null,
): Array<{ v: string; k: string }> {
  return [
    { v: patchVersion || '—', k: 'PATCH' },
    { v: championCount > 0 ? String(championCount) : '—', k: 'CHAMPIONS' },
    { v: formatSnapshotDate(snapshotDate) || '—', k: 'SNAPSHOT' },
  ];
}

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
  return clientAuthCallbackUrl(next);
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

export function AuthPanel({
  patchVersion = null,
  championCount = 0,
  snapshotDate = null,
}: {
  patchVersion?: string | null;
  championCount?: number;
  snapshotDate?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    () => modeFromSearch(searchParams.get('mode')) ?? 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [riotId, setRiotId] = useState('');
  const [remember, setRemember] = useState(true);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('NA');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [onApple, setOnApple] = useState(false);

  const copy = COPY[mode];
  const strength = useMemo(() => passwordStrength(password), [password]);
  const showSso = mode === 'signin' || mode === 'signup';
  const configured = isSupabaseConfigured();
  const ssoProviders = useMemo(() => SSO.filter((p) => !p.appleOnly || onApple), [onApple]);
  const afterAuth = safeNextPath(searchParams.get('next'));

  function finishAuth() {
    router.replace(afterAuth);
    router.refresh();
  }

  function goMode(next: Mode) {
    setNotice(null);
    setMode(next);
    if (next === 'signin' || next === 'signup' || next === 'forgot') {
      router.replace(loginHref(next as AuthMode, afterAuth), { scroll: false });
    }
  }

  useEffect(() => {
    setOnApple(isAppleDevice());
  }, []);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) setNotice({ kind: 'err', text: friendlyAuthError(error) });
    const next = modeFromSearch(searchParams.get('mode'));
    if (next) setMode(next);
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
        finishAuth();
      }
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user && mode !== 'reset') {
        finishAuth();
      }
    });
    return () => subscription.unsubscribe();
  }, [afterAuth, configured, mode, router]);

  async function submit() {
    if (!configured) {
      setNotice({
        kind: 'err',
        text: 'Auth is not configured. Add Supabase keys to apps/web/.env.local.',
      });
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
          redirectTo: callbackUrl('/login?mode=reset'),
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
        finishAuth();
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
            emailRedirectTo: callbackUrl(afterAuth),
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
        finishAuth();
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
      finishAuth();
    } finally {
      setBusy(false);
    }
  }

  async function continueWith(provider: SsoProvider) {
    if (provider === 'riot') {
      setNotice({
        kind: 'err',
        text: 'Riot sign-in is not enabled yet. Use email or Google for now.',
      });
      return;
    }
    if (!configured) {
      setNotice({
        kind: 'err',
        text: 'Auth is not configured. Add Supabase keys to apps/web/.env.local.',
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl(afterAuth) },
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
                  <button type="button" className={styles.link} onClick={() => goMode('forgot')}>
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
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.4"
                    >
                      <path d="M4 12.5l5.2 5.2L20 7" />
                    </svg>
                  ) : null}
                </span>
                Keep me signed in on this device
              </button>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? <><Spinner light /> Signing in</> : 'Sign in'}
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
                <span className={styles.hint}>
                  Used to pull your match history. You can add it later.
                </span>
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
                {busy ? <><Spinner light /> Creating</> : 'Create account'}
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
                {busy ? <><Spinner light /> Sending</> : 'Send reset link'}
              </button>
              <button type="button" className={styles.secondary} onClick={() => goMode('signin')}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'sent' ? (
            <div className={styles.fields}>
              <div className={styles.emailCard}>
                <div className={styles.emailIcon} aria-hidden>
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9FCBE4"
                    strokeWidth="1.9"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3.5 6.5L12 13l8.5-6.5" />
                  </svg>
                </div>
                <div>
                  <div className={styles.emailLabel}>{email || 'your email address'}</div>
                  <div className={styles.hint}>The link expires in about an hour.</div>
                </div>
              </div>
              <button type="button" className={styles.secondary} onClick={() => goMode('signin')}>
                Back to sign in
              </button>
              <p className={styles.swapInline}>
                Nothing arrived?{' '}
                <button type="button" className={styles.link} onClick={() => goMode('forgot')}>
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
                {busy ? <><Spinner light /> Saving</> : 'Save and sign in'}
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
                {ssoProviders.map((p) => {
                  const Icon = p.Icon;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      className={styles.ssoBtn}
                      disabled={busy}
                      onClick={() => void continueWith(p.provider)}
                    >
                      <span className={p.provider === 'riot' ? styles.ssoRiot : styles.ssoIcon}>
                        <Icon />
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {copy.swap && copy.swapTo ? (
            <p className={styles.swap}>
              <span>{copy.swap[0]}</span>
              <button type="button" className={styles.link} onClick={() => goMode(copy.swapTo!)}>
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
            Lane win rates from the latest Diamond+ snapshot, not pairwise matchups.
          </p>
          <div className={styles.stats}>
            {liveStats(patchVersion, championCount, snapshotDate).map((s) => (
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
