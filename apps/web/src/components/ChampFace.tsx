import Image from 'next/image';
import { ART_BY_SLUG, FACE_FALLBACK_BG, initials } from '@/lib/champions';
import styles from './ChampFace.module.css';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
  const key = slug ?? slugify(name);
  const src = portraits?.[key] || ART_BY_SLUG[key];
  return (
    <span
      className={`${styles.face} ${round === 'soft' ? styles.soft : styles.circle} ${fill ? styles.fill : ''}`}
      style={{
        width: fill ? undefined : size,
        height: fill ? undefined : size,
        background: FACE_FALLBACK_BG,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {src ? <Image src={src} alt="" width={size} height={size} /> : initials(name)}
    </span>
  );
}
