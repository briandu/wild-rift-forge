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
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
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
