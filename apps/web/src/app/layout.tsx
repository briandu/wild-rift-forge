import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Archivo } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wild Rift Forge',
  description: 'Wild Rift counters, matchups, and draft companion.',
};

export const revalidate = 30;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
