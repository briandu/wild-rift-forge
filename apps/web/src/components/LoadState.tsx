import type { CSSProperties, ReactNode } from 'react';
import styles from './LoadState.module.css';

export function Spinner({ light = false }: { light?: boolean }) {
  return <span className={light ? `${styles.spin} ${styles.spinLight}` : styles.spin} aria-hidden />;
}

export function PendingLabel({ children }: { children: ReactNode }) {
  return (
    <span className={styles.pending}>
      <Spinner light />
      {children}
    </span>
  );
}

export function RefreshFrame({
  active,
  children,
  className,
  style,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className ? `${styles.refresh} ${className}` : styles.refresh}
      style={style}
      aria-busy={active}
    >
      {active ? (
        <div className={styles.refreshBar} aria-hidden>
          <div className={styles.refreshFill} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function FailedPanel({
  title,
  copy,
  onRetry,
}: {
  title: string;
  copy: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.failed} role="alert">
      <span className={styles.failedDot} aria-hidden />
      <div className={styles.failedCopy}>
        <p className={styles.failedTitle}>{title}</p>
        <p className={styles.failedBody}>{copy}</p>
      </div>
      {onRetry ? (
        <button type="button" className={styles.failedRetry} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyPanel({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyCopy}>{copy}</p>
      {action}
    </div>
  );
}

export function emptyCtaClass(): string {
  return styles.emptyCta ?? '';
}
