import Image from 'next/image';
import { ART_BY_SLUG, initials } from '@/lib/champions';
import { metaFor } from '@/lib/design-stubs';
import styles from './ChampFace.module.css';

export function ChampFace({
  name,
  slug,
  size = 58,
  round = 'circle',
  portraits,
  fill = false,
}: {
  name: string;
  slug?: string;
  size?: number;
  round?: 'circle' | 'soft';
  portraits?: Record<string, string>;
  fill?: boolean;
}) {
  const meta = metaFor(name);
  const key = slug ?? meta.slug;
  const src = portraits?.[key] || ART_BY_SLUG[key];
  return (
    <span
      className={`${styles.face} ${round === 'soft' ? styles.soft : styles.circle} ${fill ? styles.fill : ''}`}
      style={{
        width: fill ? undefined : size,
        height: fill ? undefined : size,
        background: meta.bg,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {src ? <Image src={src} alt="" width={size} height={size} /> : initials(name)}
    </span>
  );
}
