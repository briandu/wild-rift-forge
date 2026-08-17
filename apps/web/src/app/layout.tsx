import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Archivo } from 'next/font/google';
import { AbilityTipProvider } from '@/components/AbilityTip';
import { SITE_DESCRIPTION, SITE_ICONS, SITE_NAME, SITE_TITLE, absoluteUrl } from '@/lib/seo';
import { PRODUCTION_SITE_URL } from '@/lib/supabase/site-url';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: PRODUCTION_SITE_URL }],
  alternates: { canonical: absoluteUrl('/') },
  icons: SITE_ICONS,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: PRODUCTION_SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const revalidate = 30;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <AbilityTipProvider>{children}</AbilityTipProvider>
        <Analytics />
      </body>
    </html>
  );
}
