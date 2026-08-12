import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: '**.leagueoflegends.com' },
      { protocol: 'https', hostname: '**.riotgames.com' },
      { protocol: 'https', hostname: 'cmsassets.rgpub.io' },
      { protocol: 'https', hostname: '**.rgpub.io' },
    ],
  },
};

export default nextConfig;
