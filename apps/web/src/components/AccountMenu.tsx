'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
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
      <Link href="/auth" className={styles.avatar} aria-label="Sign in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
        </svg>
      </Link>
    );
  }

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
          <div className={styles.accountEmail}>{user.email}</div>
          <button type="button" className={styles.accountAction} role="menuitem" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
