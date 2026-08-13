import Link from 'next/link';
import styles from './MobileBottomNav.module.css';

const TABS = [
  { href: '/', label: 'Counters', match: 'counters', icon: 'search' },
  { href: '/champions', label: 'Champs', match: 'champions', icon: 'champs' },
  { href: '/tier', label: 'Tiers', match: 'tier', icon: 'tier' },
  { href: '/draft', label: 'Draft', match: 'draft', icon: 'draft' },
  { href: '/patch', label: 'Patch', match: 'patch', icon: 'patch' },
  { href: '/me', label: 'Me', match: 'me', icon: 'me' },
] as const;

function isActive(pathname: string, match: string): boolean {
  if (match === 'counters') {
    return pathname === '/' || pathname.startsWith('/counters') || pathname.startsWith('/matchups');
  }
  if (match === 'me') {
    return pathname === '/me' || pathname.startsWith('/auth');
  }
  return pathname.startsWith(`/${match}`);
}

function TabIcon({ name, active }: { name: (typeof TABS)[number]['icon']; active: boolean }) {
  const stroke = active ? '#16C0FF' : '#5C5878';
  const width = active ? 2.4 : 1.9;
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === 'search' ? (
        <g>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.6-3.6" />
        </g>
      ) : null}
      {name === 'champs' ? (
        <g>
          <rect x="5" y="3.5" width="14" height="17" rx="3.5" />
          <circle cx="12" cy="9.5" r="2.4" />
          <path d="M8.2 16.8c.7-2.1 2.2-3.2 3.8-3.2s3.1 1.1 3.8 3.2" />
        </g>
      ) : null}
      {name === 'tier' ? (
        <g>
          <path d="M4 6h16" />
          <path d="M4 12h11" />
          <path d="M4 18h6" />
        </g>
      ) : null}
      {name === 'draft' ? (
        <g>
          <rect x="3" y="4" width="7" height="7" rx="2" />
          <rect x="14" y="4" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </g>
      ) : null}
      {name === 'patch' ? (
        <g>
          <path d="M4 19V7.5a2 2 0 012-2h9l4 4V19a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
          <path d="M8.5 12h7" />
          <path d="M8.5 16h4" />
        </g>
      ) : null}
      {name === 'me' ? (
        <g>
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.8 20c1.2-3.6 3.9-5.4 7.2-5.4s6 1.8 7.2 5.4" />
        </g>
      ) : null}
    </svg>
  );
}

export function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className={styles.nav} aria-label="Mobile primary">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.match);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <TabIcon name={tab.icon} active={active} />
            <span className={active ? styles.labelActive : styles.label}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
