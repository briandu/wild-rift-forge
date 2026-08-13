import { afterEach, describe, expect, it } from 'vitest';
import {
  PRODUCTION_SITE_URL,
  authCallbackUrl,
  isLocalHost,
  requestSiteOrigin,
} from './site-url';

const originalVercel = process.env.VERCEL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('isLocalHost', () => {
  it('treats loopback hosts as local, including a port', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('localhost:3002')).toBe(true);
    expect(isLocalHost('127.0.0.1:3001')).toBe(true);
    expect(isLocalHost('www.wildriftforge.com')).toBe(false);
  });
});

describe('authCallbackUrl', () => {
  it('keeps the origin port and optional next path', () => {
    expect(authCallbackUrl('http://localhost:3002')).toBe('http://localhost:3002/auth/callback');
    expect(authCallbackUrl('http://localhost:3002', '/login?mode=reset')).toBe(
      'http://localhost:3002/auth/callback?next=%2Flogin%3Fmode%3Dreset',
    );
  });
});

describe('requestSiteOrigin', () => {
  it('returns the local request host and port', () => {
    delete process.env.VERCEL;
    const req = new Request('http://localhost:3002/auth/callback');
    expect(requestSiteOrigin(req)).toBe('http://localhost:3002');
  });

  it('uses the forwarded local port when not on Vercel', () => {
    delete process.env.VERCEL;
    const req = new Request('http://127.0.0.1:3000/auth/callback', {
      headers: { 'x-forwarded-host': 'localhost:3002' },
    });
    expect(requestSiteOrigin(req)).toBe('http://localhost:3002');
  });

  it('uses the public forwarded host on Vercel instead of localhost', () => {
    process.env.VERCEL = '1';
    const req = new Request('http://localhost:3000/auth/callback', {
      headers: { 'x-forwarded-host': 'www.wildriftforge.com' },
    });
    expect(requestSiteOrigin(req)).toBe('https://www.wildriftforge.com');
  });

  it('falls back to the production site on Vercel without a public host', () => {
    process.env.VERCEL = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const req = new Request('http://localhost:3000/auth/callback');
    expect(requestSiteOrigin(req)).toBe(PRODUCTION_SITE_URL);
  });
});
