import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth-next';
import { requestSiteOrigin } from '@/lib/supabase/site-url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = requestSiteOrigin(request);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const errorDescription = searchParams.get('error_description') ?? searchParams.get('error');

  if (errorDescription) {
    const params = new URLSearchParams({ error: errorDescription });
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing auth code')}`);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Auth is not configured')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: sessionData } = await supabase.auth.getUser();
  if (sessionData.user) {
    await supabase.rpc('ensure_default_avatar');
  }

  return NextResponse.redirect(`${origin}${next}`);
}
