import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Shell.module.css';

const NAV = [
  { href: '/champions/sett', label: 'Champions', match: '/champions' },
  { href: '/', label: 'Counters', match: '/counters', alsoHome: true },
  { href: '/draft', label: 'Draft', match: '/draft' },
] as const;

export function Shell({
  children,
  pathname = '/',
  patchLabel = 'Patch —',
}: {
  children: ReactNode;
  pathname?: string;
  patchLabel?: string;
}) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="RIFTLINE home">
          <Image
            src="/logo-wr-forge.png"
            alt="RIFTLINE"
            width={160}
            height={48}
            priority
            className={styles.logo}
          />
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((item) => {
            const active =
              pathname.startsWith(item.match) ||
              ('alsoHome' in item && item.alsoHome && pathname === '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                className={active ? styles.navActive : styles.navLink}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.spacer} />
        <div className={styles.patch}>{patchLabel}</div>
      </header>
      <main>{children}</main>
    </div>
  );
}
