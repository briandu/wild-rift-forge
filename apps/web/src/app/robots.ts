import type { MetadataRoute } from 'next';
import { PRODUCTION_SITE_URL } from '@/lib/supabase/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/me', '/login', '/emails', '/auth/', '/api/'],
      },
    ],
    sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    host: PRODUCTION_SITE_URL,
  };
}
