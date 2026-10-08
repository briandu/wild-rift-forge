import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/auth', destination: '/login', permanent: true }];
  },
  transpilePackages: [
    '@wild-rift-forge/api',
    '@wild-rift-forge/database',
    '@wild-rift-forge/game-data',
    '@wild-rift-forge/vision',
  ],
  serverExternalPackages: ['pg'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  images: {
    qualities: [75, 90],
    // Hosts that still use the optimizer. A cache miss re-downloads the full
    // original, so keep the optimized file for 30 days.
    // Supabase Storage is omitted on purpose. Those URLs render unoptimized
    // (apps/web/src/lib/storage-image.ts) and the browser loads the hosted object.
    // Listing them here would let /_next/image fetch the originals again.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: 'https', hostname: '**.leagueoflegends.com' },
      { protocol: 'https', hostname: '**.riotgames.com' },
      { protocol: 'https', hostname: 'cmsassets.rgpub.io' },
      { protocol: 'https', hostname: '**.rgpub.io' },
      { protocol: 'https', hostname: 'www.mobafire.com' },
      { protocol: 'https', hostname: 'www.wildriftfire.com' },
    ],
  },
};

export default nextConfig;
