import { describe, expect, it } from 'vitest';
import { artFor, portraitFor } from './champions';
import { isSupabaseStorageSrc, omitStorageUrl, stripStorageFields } from './storage-image';

const PORTRAIT =
  'https://hplpzzeeibvhpgahddeu.supabase.co/storage/v1/object/public/game-assets/champions/rell.jpg';

describe('isSupabaseStorageSrc', () => {
  it('matches public game-assets objects', () => {
    expect(isSupabaseStorageSrc(PORTRAIT)).toBe(true);
  });

  it('matches signed storage URLs', () => {
    expect(
      isSupabaseStorageSrc(
        'https://hplpzzeeibvhpgahddeu.supabase.co/storage/v1/object/sign/draft-captures/lobby.jpg?token=abc',
      ),
    ).toBe(true);
  });

  it('matches the supabase.in storage host', () => {
    expect(
      isSupabaseStorageSrc('https://project.supabase.in/storage/v1/object/public/game-assets/a.webp'),
    ).toBe(true);
  });

  it('leaves local files and other CDNs on the optimizer', () => {
    expect(isSupabaseStorageSrc('/logo-wr-forge.png')).toBe(false);
    expect(isSupabaseStorageSrc('/more_art-1786470895713-hupj.avif')).toBe(false);
    expect(isSupabaseStorageSrc('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg')).toBe(
      false,
    );
    expect(isSupabaseStorageSrc('https://hplpzzeeibvhpgahddeu.supabase.co/auth/v1/user')).toBe(false);
    expect(isSupabaseStorageSrc('https://evil.supabase.co.example/storage/v1/object/public/x.jpg')).toBe(false);
  });
});

describe('omitStorageUrl', () => {
  it('drops storage urls and keeps everything else', () => {
    expect(omitStorageUrl(PORTRAIT)).toBeUndefined();
    expect(omitStorageUrl('/logo-wr-forge.png')).toBe('/logo-wr-forge.png');
    expect(artFor('rell', PORTRAIT)).toBe('/hero-fallback.avif');
    expect(portraitFor('ashe', PORTRAIT, PORTRAIT)).toBe('/more_art-1786470895700-w5u0.avif');
  });

  it('strips nested champion art from a payload', () => {
    const stripped = stripStorageFields({
      enemy: { imageUrl: PORTRAIT, thumbnailUrl: PORTRAIT, name: 'Rell' },
      picks: [{ imageUrl: '/local.png' }],
    });
    expect(stripped.enemy.imageUrl).toBeNull();
    expect(stripped.enemy.thumbnailUrl).toBeNull();
    expect(stripped.enemy.name).toBe('Rell');
    expect(stripped.picks[0]?.imageUrl).toBe('/local.png');
  });
});
