import Link from 'next/link';
import { Shell } from '@/components/Shell';

export default function NotFound() {
  return (
    <Shell pathname="/">
      <section style={{ padding: '72px 48px' }}>
        <p style={{ color: 'var(--accent-soft)', letterSpacing: '0.22em', fontWeight: 700, fontSize: 13 }}>
          NOT FOUND
        </p>
        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', margin: '12px 0 0' }}>
          Nothing here.
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
          That champion or page is missing.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            marginTop: 28,
            height: 46,
            alignItems: 'center',
            padding: '0 22px',
            borderRadius: 12,
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          }}
        >
          Back home
        </Link>
      </section>
    </Shell>
  );
}
