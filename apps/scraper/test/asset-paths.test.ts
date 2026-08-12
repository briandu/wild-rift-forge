import { describe, expect, it } from 'vitest';
import { championImageStoragePath, extensionForImage } from '../src/assets/paths';

describe('extensionForImage', () => {
  it('maps common image content types', () => {
    expect(extensionForImage('image/webp')).toBe('webp');
    expect(extensionForImage('image/png; charset=binary')).toBe('png');
    expect(extensionForImage('image/jpeg')).toBe('jpg');
  });

  it('falls back to the URL extension when content-type is opaque', () => {
    expect(
      extensionForImage(
        'application/octet-stream',
        'https://cdn.example.com/path/aatrox.png?w=200',
      ),
    ).toBe('png');
  });

  it('defaults to bin when nothing is known', () => {
    expect(extensionForImage('application/octet-stream')).toBe('bin');
  });
});

describe('championImageStoragePath', () => {
  it('builds a stable champions/{slug}.ext path', () => {
    expect(championImageStoragePath('aatrox', 'webp')).toBe('champions/aatrox.webp');
  });
});
