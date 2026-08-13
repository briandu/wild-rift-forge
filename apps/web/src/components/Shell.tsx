import { Suspense, type ReactNode } from 'react';
import { fetchLatestPatch } from '@/lib/api';
import { MobileBottomNav } from './MobileBottomNav';
import { NavSearch } from './NavSearch';
import { SiteHeader } from './SiteHeader';
import styles from './Shell.module.css';

export async function Shell({
  children,
  pathname = '/',
  patchLabel,
  showChrome = true,
}: {
  children: ReactNode;
  pathname?: string;
  patchLabel?: string;
  showChrome?: boolean;
}) {
  const latestVersion = showChrome && !patchLabel ? (await fetchLatestPatch())?.patch.version : undefined;
  const liveLabel = patchLabel ?? (latestVersion ? `Patch ${latestVersion}` : 'Patch');

  return (
    <div className={styles.root}>
      {showChrome ? (
        <>
          <SiteHeader
            pathname={pathname}
            patchLabel={liveLabel}
            showSearch={pathname !== '/'}
            compactSearch={
              pathname === '/' ? null : (
                <Suspense fallback={<div className={styles.searchFallback} aria-hidden />}>
                  <NavSearch />
                </Suspense>
              )
            }
            overlaySearch={
              pathname === '/' ? null : (
                <Suspense fallback={null}>
                  <NavSearch variant="overlay" />
                </Suspense>
              )
            }
          />
          <MobileBottomNav pathname={pathname} />
        </>
      ) : null}
      <main className={showChrome ? styles.main : undefined}>{children}</main>
    </div>
  );
}
