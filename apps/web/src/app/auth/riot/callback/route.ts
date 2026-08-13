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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const origin = siteOrigin(request);
  if (!code) {
    return NextResponse.redirect(`${origin}/me?error=riot-missing-code`);
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.RIOT_CLIENT_ID ?? process.env.NEXT_PUBLIC_RIOT_CLIENT_ID;
  const secret = process.env.RIOT_CLIENT_SECRET;
  if (!clientId || !secret) {
    return NextResponse.redirect(`${origin}/me?error=riot-not-configured`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const redirectUri = process.env.RIOT_REDIRECT_URI ?? `${origin}/auth/riot/callback`;
  const tokenRes = await fetch('https://auth.riotgames.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: secret,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/me?error=riot-token`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/me?error=riot-token`);
  }

  const infoRes = await fetch('https://auth.riotgames.com/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    return NextResponse.redirect(`${origin}/me?error=riot-userinfo`);
  }
  const info = (await infoRes.json()) as { sub?: string; name?: string };
  const riotId = info.name?.trim() || info.sub || null;
  if (!riotId) {
    return NextResponse.redirect(`${origin}/me?error=riot-empty`);
  }

  await supabase.from('profiles').upsert(
    { id: data.user.id, riot_id: riotId, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );

  return NextResponse.redirect(`${origin}/me`);
}
