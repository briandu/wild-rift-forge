import type { MetadataRoute } from 'next';
import { fetchChampions } from '@/lib/api';
import { absoluteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const champions = await fetchChampions();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/champions'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/matchups'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/tier'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/draft'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/patch'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const championRoutes = champions.flatMap((champion) => [
    {
      url: absoluteUrl(`/champions/${champion.slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    {
      url: absoluteUrl(`/counters/${champion.slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ]);

  return [...staticRoutes, ...championRoutes];
}
