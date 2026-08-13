import Image from 'next/image';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { AccountMenu } from './AccountMenu';
import { MobileBottomNav } from './MobileBottomNav';
import { NavSearch } from './NavSearch';
import styles from './Shell.module.css';

const NAV = [
  { href: '/champions', label: 'Champions', match: '/champions' },
  { href: '/', label: 'Counters', match: '/counters', alsoHome: true },
  { href: '/matchups', label: 'Matchups', match: '/matchups' },
  { href: '/tier', label: 'Tier List', match: '/tier' },
  { href: '/draft', label: 'Draft', match: '/draft' },
  { href: '/patch', label: 'Patch', match: '/patch' },
] as const;

export function Shell({
  children,
  pathname = '/',
  patchLabel = 'Patch 6.2b',
  showChrome = true,
}: {
  children: ReactNode;
  pathname?: string;
  patchLabel?: string;
  showChrome?: boolean;
}) {
  return (
    <div className={styles.root}>
      {showChrome ? (
        <>
          <header className={styles.header}>
            <Link href="/" className={styles.brand} aria-label="Wild Rift Forge home">
              <Image
                src="/logo-wr-forge.png"
                alt="Wild Rift Forge"
                width={132}
                height={58}
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
            <div className={styles.search}>
              <Suspense fallback={<div className={styles.searchFallback} aria-hidden />}>
                <NavSearch />
              </Suspense>
            </div>
            <Link href="/patch" className={styles.patch}>
              {patchLabel}
            </Link>
            <AccountMenu />
          </header>
          <MobileBottomNav pathname={pathname} />
        </>
      ) : null}
      <main className={showChrome ? styles.main : undefined}>{children}</main>
    </div>
  );
}
