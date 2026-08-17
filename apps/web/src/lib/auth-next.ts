export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

/** Same-origin relative path only. Rejects protocol-relative and off-site URLs. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function loginHref(mode: AuthMode = 'signin', next = '/'): string {
  const params = new URLSearchParams();
  if (mode !== 'signin') params.set('mode', mode);
  const dest = safeNextPath(next);
  if (dest !== '/') params.set('next', dest);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

export function matchupReturnPath(input: {
  you: string;
  them: string;
  lane: string;
  save?: boolean;
}): string {
  const params = new URLSearchParams({
    you: input.you,
    them: input.them,
    lane: input.lane,
  });
  if (input.save) params.set('save', '1');
  return `/matchups?${params}`;
}
