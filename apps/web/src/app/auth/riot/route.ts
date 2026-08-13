import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === 'development') return url.origin;
  const host = request.headers.get('x-forwarded-host');
  return host ? `https://${host}` : url.origin;
}

export async function GET(request: Request) {
  const clientId = process.env.RIOT_CLIENT_ID ?? process.env.NEXT_PUBLIC_RIOT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL('/me?tab=overview&error=riot-not-configured', request.url));
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(new URL('/login?next=/auth/riot', request.url));
  }

  const origin = siteOrigin(request);
  const redirectUri = process.env.RIOT_REDIRECT_URI ?? `${origin}/auth/riot/callback`;
  const authorize = new URL('https://auth.riotgames.com/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid');
  authorize.searchParams.set('state', data.user.id);
  return NextResponse.redirect(authorize);
}
