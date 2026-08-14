'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountMenu } from './AccountMenu';
import styles from './Shell.module.css';

const NAV = [
  { href: '/', label: 'Counters', match: '/counters', alsoHome: true },
  { href: '/champions', label: 'Champions', match: '/champions' },
  { href: '/matchups', label: 'Matchups', match: '/matchups' },
  { href: '/tier', label: 'Tier List', match: '/tier' },
  { href: '/draft', label: 'Draft', match: '/draft' },
  { href: '/patch', label: 'Patch', match: '/patch' },
] as const;

function isActive(pathname: string, item: (typeof NAV)[number]): boolean {
  return pathname.startsWith(item.match) || ('alsoHome' in item && item.alsoHome && pathname === '/');
}

export function SiteHeader({
  pathname,
  patchLabel,
  showSearch = true,
  compactSearch,
  overlaySearch,
}: {
  pathname: string;
  patchLabel: string;
  showSearch?: boolean;
  compactSearch: ReactNode;
  overlaySearch: ReactNode;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showSearch) setSearchOpen(false);
  }, [showSearch]);

  useEffect(() => {
    const searchMq = window.matchMedia('(min-width: 1241px)');
    const menuDesktopMq = window.matchMedia('(min-width: 901px)');
    const menuPhoneMq = window.matchMedia('(max-width: 600px)');

    function onViewport() {
      if (searchMq.matches) setSearchOpen(false);
      if (menuDesktopMq.matches || menuPhoneMq.matches) setMenuOpen(false);
    }

    searchMq.addEventListener('change', onViewport);
    menuDesktopMq.addEventListener('change', onViewport);
    menuPhoneMq.addEventListener('change', onViewport);
    return () => {
      searchMq.removeEventListener('change', onViewport);
      menuDesktopMq.removeEventListener('change', onViewport);
      menuPhoneMq.removeEventListener('change', onViewport);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }

    function onPointer(event: MouseEvent) {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      setSearchOpen(false);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen, searchOpen]);

  return (
    <header ref={headerRef} className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Wild Rift Forge home">
        <Image
          src="/logo-wr-forge.png"
          alt="Wild Rift Forge"
          width={132}
          height={58}
          priority
          className={styles.logo}
        />
        <Image
          src="/logo-wr-forge-no-text.png"
          alt=""
          width={43}
          height={44}
          className={styles.mark}
        />
      </Link>
      <button
        type="button"
        className={styles.burger}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls="site-nav-drawer"
        onClick={() => {
          setSearchOpen(false);
          setMenuOpen((open) => !open);
        }}
      >
        {menuOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DEDCEE" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DEDCEE" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
      {menuOpen ? (
        <div id="site-nav-drawer" className={styles.drawer} role="dialog" aria-label="Site">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={styles.drawerItem}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span className={active ? styles.drawerTickOn : styles.drawerTick} />
                <span className={active ? styles.drawerLabelOn : styles.drawerLabel}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
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
      <div className={styles.navRight}>
        {showSearch ? (
          <>
            <button
              type="button"
              className={styles.searchBtn}
              aria-label={searchOpen ? 'Close search' : 'Search champion'}
              aria-expanded={searchOpen}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen((open) => !open);
              }}
            >
              {searchOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BBB7D4" strokeWidth="2.2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7FDCFF" strokeWidth="2" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              )}
            </button>
            <div className={styles.search}>{compactSearch}</div>
          </>
        ) : null}
        <Link href="/patch" className={styles.patch}>
          {patchLabel}
        </Link>
        <span className={styles.beta} tabIndex={0} aria-describedby="beta-tooltip">
          Beta
          <span id="beta-tooltip" role="tooltip" className={styles.betaTip}>
            We are still a work in progress. Not everything is fully operational. Thank you, and check back again!
          </span>
        </span>
        <AccountMenu />
      </div>
      {showSearch && searchOpen ? (
        <div className={styles.searchOverlay} role="search">
          {overlaySearch}
        </div>
      ) : null}
    </header>
  );
}
