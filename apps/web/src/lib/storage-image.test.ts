import { describe, expect, it } from 'vitest';
import { isSupabaseStorageSrc } from './storage-image';

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
