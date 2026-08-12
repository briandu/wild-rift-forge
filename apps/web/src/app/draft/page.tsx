import Link from 'next/link';
import { Shell } from '@/components/Shell';
import styles from './page.module.css';

export default function DraftStubPage() {
  return (
    <Shell pathname="/draft">
      <section className={styles.panel}>
        <p className={styles.eyebrow}>DRAFT ASSISTANT</p>
        <h1 className={styles.title}>Draft board coming next.</h1>
        <p className={styles.copy}>
          Ally and enemy slots, fit scores, and ban suggestions from the Premium Gaming handoff will
          land here once the recommendation layer exists.
        </p>
        <Link href="/" className={styles.primary}>
          Find a counter instead
        </Link>
      </section>
    </Shell>
  );
}
