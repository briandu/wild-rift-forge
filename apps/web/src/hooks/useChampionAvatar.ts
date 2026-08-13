'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { applyChampionAvatar, avatarUrlFromUser, loadChampionAvatar } from '@/lib/user-avatar';

export function useChampionAvatar(user: User | null) {
  const [url, setUrl] = useState<string | undefined>(() => avatarUrlFromUser(user));

  const reload = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setUrl(undefined);
      return;
    }
    const supabase = createClient();
    const result = await loadChampionAvatar(supabase, user);
    if (result.url) setUrl(result.url);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUrl(undefined);
      return;
    }
    const existing = avatarUrlFromUser(user);
    if (existing) {
      setUrl(existing);
      return;
    }
    void reload();
  }, [user, reload]);

  const choose = useCallback(
    async (slug: string) => {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      const result = await applyChampionAvatar(supabase, slug);
      if (result.url) setUrl(result.url);
    },
    [],
  );

  return { url, choose, reload };
}