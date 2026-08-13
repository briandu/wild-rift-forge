import { Suspense, type ReactNode } from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import { NavSearch } from './NavSearch';
import { SiteHeader } from './SiteHeader';
import styles from './Shell.module.css';

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
          <SiteHeader
            pathname={pathname}
            patchLabel={patchLabel}
            compactSearch={
              <Suspense fallback={<div className={styles.searchFallback} aria-hidden />}>
                <NavSearch />
              </Suspense>
            }
            overlaySearch={
              <Suspense fallback={null}>
                <NavSearch variant="overlay" />
              </Suspense>
            }
          />
          <MobileBottomNav pathname={pathname} />
        </>
      ) : null}
      <main className={showChrome ? styles.main : undefined}>{children}</main>
    </div>
  );
}
