'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useChampionAvatar } from '@/hooks/useChampionAvatar';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { firstNameFromUser, fullNameFromUser } from '@/lib/user-name';
import styles from './Shell.module.css';

const ACCOUNT_MENU = [
  { href: '/me', label: 'Account' },
  { href: '/me?tab=pool', label: 'Champion pool' },
  { href: '/me?tab=saved', label: 'Saved matchups' },
  { href: '/me?tab=notifications', label: 'Notifications' },
  { href: '/me?tab=plan', label: 'Plan', meta: 'Beta' },
] as const;

function initialsFor(user: User): string {
  const name = fullNameFromUser(user);
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return '?';
}

function riotIdFor(user: User): string | null {
  const meta = user.user_metadata as { riot_id?: string } | undefined;
  return meta?.riot_id?.trim() || null;
}

function displayName(user: User, riotId: string | null): string {
  if (riotId) return riotId;
  return fullNameFromUser(user) || firstNameFromUser(user) || user.email || 'Account';
}

function pathAfterSignOut(pathname: string): string {
  if (pathname === '/me' || pathname.startsWith('/me/')) return '/';
  return pathname;
}

export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [riotId, setRiotId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const { url: avatarUrl } = useChampionAvatar(user);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setRiotId(null);
      return;
    }
    const supabase = createClient();
    void supabase
      .from('profiles')
      .select('riot_id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRiotId((data as { riot_id?: string | null } | null)?.riot_id?.trim() || riotIdFor(user));
      });
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    setOpen(false);
    await createClient().auth.signOut();
    setUser(null);
    const next = pathAfterSignOut(pathname);
    if (next !== pathname) router.push(next);
    router.refresh();
  }

  if (!ready) {
    return <span className={styles.avatar} aria-hidden />;
  }

  if (!user) {
    return (
      <div className={styles.authActions}>
        <Link href="/login" className={styles.signIn}>
          Sign in
        </Link>
        <Link href="/login?mode=signup" className={styles.createAccount}>
          Create account
        </Link>
      </div>
    );
  }

  const name = displayName(user, riotId);

  return (
    <div className={styles.account} ref={rootRef}>
      <button
        type="button"
        className={styles.avatar}
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={34} height={34} />
        ) : (
          initialsFor(user)
        )}
      </button>
      {open ? (
        <div className={styles.accountMenu} role="menu">
          <div className={styles.accountHead}>
            <div className={styles.accountHeadFace} aria-hidden>
              {avatarUrl ? <Image src={avatarUrl} alt="" width={38} height={38} /> : null}
            </div>
            <div className={styles.accountHeadCopy}>
              <div className={styles.accountName}>{name}</div>
              <div className={styles.accountRank}>{riotId ? 'Riot ID connected' : 'No Riot ID connected'}</div>
            </div>
          </div>
          <div className={styles.accountRule} />
          {ACCOUNT_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.accountItem}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span>{item.label}</span>
              {'meta' in item && item.meta ? <span className={styles.accountMeta}>{item.meta}</span> : null}
            </Link>
          ))}
          <button type="button" className={styles.accountSignOut} role="menuitem" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
