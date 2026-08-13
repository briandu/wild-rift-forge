'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ACCOUNT_MENU, ACCOUNT_STUB } from '@/lib/design-stubs';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import styles from './Shell.module.css';

function initialsFor(user: User): string {
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = meta?.full_name || meta?.name;
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return '?';
}

function riotIdFor(user: User): string {
  const meta = user.user_metadata as { riot_id?: string } | undefined;
  return meta?.riot_id?.trim() || ACCOUNT_STUB.riotId;
}

export function AccountMenu() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

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

  const riotId = riotIdFor(user);

  return (
    <div className={styles.account} ref={rootRef}>
      <button
        type="button"
        className={styles.avatar}
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {initialsFor(user)}
      </button>
      {open ? (
        <div className={styles.accountMenu} role="menu">
          <div className={styles.accountHead}>
            <div className={styles.accountHeadFace} aria-hidden />
            <div className={styles.accountHeadCopy}>
              <div className={styles.accountName}>{riotId}</div>
              <div className={styles.accountRank}>{ACCOUNT_STUB.rankLine}</div>
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
