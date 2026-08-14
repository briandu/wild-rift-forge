import type { TierLane } from '@wild-rift-forge/game-data';
import { loadPreferredRoles } from '../account';
import { DEFAULT_ROLE_ORDER } from '../roles';
import { isSupabaseConfigured } from '../supabase/env';
import { createClient } from '../supabase/server';

export async function loadViewerRoleOrder(): Promise<TierLane[]> {
  if (!isSupabaseConfigured()) return [...DEFAULT_ROLE_ORDER];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [...DEFAULT_ROLE_ORDER];
    return loadPreferredRoles(supabase, user.id);
  } catch {
    return [...DEFAULT_ROLE_ORDER];
  }
}
