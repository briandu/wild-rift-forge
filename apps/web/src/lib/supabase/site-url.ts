/** Canonical production origin. Apex `wildriftforge.com` 308s to www. */
export const PRODUCTION_SITE_URL = 'https://www.wildriftforge.com';

export function isLocalHost(host: string): boolean {
  const hostname = host.toLowerCase().split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

export function configuredSiteUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, '');
}

export function authCallbackUrl(origin: string, next = '/'): string {
  const url = new URL('/auth/callback', origin);
  if (next !== '/') url.searchParams.set('next', next);
  return url.toString();
}

/**
 * Browser callback. Local always uses the origin+port the page was loaded on
 * (`next dev --port 3002` → `http://localhost:3002`). Production may use
 * `NEXT_PUBLIC_SITE_URL` so apex/preview hosts still return to www.
 */
export function clientAuthCallbackUrl(next = '/'): string {
  const here = window.location.origin;
  if (isLocalHost(window.location.hostname)) {
    return authCallbackUrl(here, next);
  }
  return authCallbackUrl(configuredSiteUrl() ?? here, next);
}

/**
 * Server-side public origin after OAuth.
 * Local (`next dev` / `next start`): the host+port that handled the request.
 * Vercel: `request.url` is often `http://localhost:3000` — ignore that and use
 * the forwarded public host or the configured production site.
 */
export function requestSiteOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? url.host;
  const onVercel = process.env.VERCEL === '1';

  if (isLocalHost(host) && !onVercel) {
    const proto = url.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${host}`;
  }

  if (forwardedHost && !isLocalHost(forwardedHost)) {
    return `https://${forwardedHost}`;
  }

  const configured = configuredSiteUrl();
  if (configured && !isLocalHost(configured)) return configured;

  if (!isLocalHost(url.hostname)) return url.origin;

  return PRODUCTION_SITE_URL;
}
