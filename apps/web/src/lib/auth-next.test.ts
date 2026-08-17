import { describe, expect, it } from 'vitest';
import { loginHref, matchupReturnPath, safeNextPath } from './auth-next';

describe('safeNextPath', () => {
  it('keeps same-origin relative paths, including a query string', () => {
    expect(safeNextPath('/matchups?you=garen&them=darius&save=1')).toBe(
      '/matchups?you=garen&them=darius&save=1',
    );
  });

  it('rejects missing, off-site, and protocol-relative values', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('https://evil.example/phish')).toBe('/');
    expect(safeNextPath('//evil.example/phish')).toBe('/');
  });
});

describe('loginHref', () => {
  it('omits default sign-in and home so /login stays clean', () => {
    expect(loginHref()).toBe('/login');
    expect(loginHref('signup', '/matchups?you=garen&them=darius&save=1')).toBe(
      '/login?mode=signup&next=%2Fmatchups%3Fyou%3Dgaren%26them%3Ddarius%26save%3D1',
    );
  });
});

describe('matchupReturnPath', () => {
  it('asks the matchup page to save after auth', () => {
    expect(matchupReturnPath({ you: 'garen', them: 'darius', lane: 'Top', save: true })).toBe(
      '/matchups?you=garen&them=darius&lane=Top&save=1',
    );
  });
});
