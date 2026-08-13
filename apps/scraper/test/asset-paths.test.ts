import { describe, expect, it } from 'vitest';
import { championImageStoragePath, championThumbnailStoragePath, extensionForImage } from '../src/assets/paths';
import { highQualitySanityUrl } from '../src/sources/riot/image-url';

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
    expect(championThumbnailStoragePath('aatrox', 'png')).toBe('champions/aatrox-thumb.png');
  });
});

describe('highQualitySanityUrl', () => {
  it('pins Sanity CDN images to max JPEG quality', () => {
    const url = highQualitySanityUrl(
      'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data/abc-1280x720.jpg?accountingTag=WR',
    );
    expect(url).toContain('q=100');
    expect(url).toContain('fm=jpg');
    expect(url).toContain('accountingTag=WR');
  });

  it('leaves non-Sanity URLs unchanged', () => {
    const url = 'https://example.com/aatrox.png';
    expect(highQualitySanityUrl(url)).toBe(url);
  });
});
