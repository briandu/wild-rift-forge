import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { fetchChampion } from '@/lib/api';
import styles from './page.module.css';

export default async function ChampionProfileStub({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const champion = await fetchChampion(slug);
  const name = champion?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <Shell pathname={`/champions/${slug}`}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>CHAMPION PROFILE</p>
        <h1 className={styles.title}>{name}</h1>
        <p className={styles.copy}>
          Full matchup tables and build tabs land next. For now, jump into counters for this pick.
        </p>
        <div className={styles.actions}>
          <Link href={`/counters/${slug}`} className={styles.primary}>
            View counters
          </Link>
          <Link href="/" className={styles.secondary}>
            Back home
          </Link>
        </div>
      </section>
    </Shell>
  );
}
