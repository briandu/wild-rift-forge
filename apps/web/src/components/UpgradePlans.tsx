'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PLAN_MATRIX, PLANS, type Billing, type PlanId } from '@/lib/plans';
import styles from './UpgradePlans.module.css';

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FEDB8" strokeWidth="3" aria-hidden>
      <path d="M4 12.5l5.2 5.2L20 7" />
    </svg>
  );
}

export function UpgradePlans({
  current = 'Free',
  waitlisted = false,
  onJoinWaitlist,
  backHref = '/me?tab=plan',
  embedded = false,
}: {
  current?: PlanId;
  waitlisted?: boolean;
  onJoinWaitlist?: () => void;
  backHref?: string;
  embedded?: boolean;
}) {
  const [billing, setBilling] = useState<Billing>('Annual');
  const [pick, setPick] = useState<PlanId>('Pro');
  const annual = billing === 'Annual';

  return (
    <div className={embedded ? styles.embedded : undefined}>
      <div className={styles.hero}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.heroInner}>
          {embedded ? null : (
            <Link href={backHref} className={styles.back}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M14 6l-6 6 6 6" />
              </svg>
              Back to account
            </Link>
          )}
          <h1 className={styles.title}>Climb with your own data</h1>
          <p className={styles.copy}>
            Free covers the whole site. Pro turns your match history into the source and puts the
            plan inside champion select.
          </p>
          <div className={styles.billing} role="group" aria-label="Billing">
            {(['Monthly', 'Annual'] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={billing === name ? styles.billOn : styles.bill}
                onClick={() => setBilling(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {annual ? <p className={styles.save}>Save two months on Annual</p> : null}
        </div>
      </div>

      <div className={styles.cards}>
        {PLANS.map((plan) => {
          const on = pick === plan.id;
          const free = plan.id === 'Free';
          const price = plan.price[billing];
          return (
            <article
              key={plan.id}
              className={on ? styles.cardOn : styles.card}
            >
              {plan.tag ? <span className={styles.tag}>{plan.tag}</span> : null}
              <div className={styles.planK}>Forge {plan.id}</div>
              <div className={styles.priceRow}>
                <span className={styles.price}>£{price}</span>
                {free ? null : <span className={styles.per}>/ month</span>}
              </div>
              <p className={styles.note}>
                {free
                  ? 'Always free'
                  : annual
                    ? `Billed £${Number(plan.price.Annual) * 12} yearly`
                    : 'Billed monthly'}
              </p>
              <p className={styles.blurb}>{plan.blurb}</p>
              {free ? (
                <Link href={backHref} className={on ? styles.ctaOn : styles.cta}>
                  Stay on Free
                </Link>
              ) : (
                <button
                  type="button"
                  className={on ? styles.ctaOn : styles.cta}
                  onClick={() => {
                    setPick(plan.id);
                    onJoinWaitlist?.();
                  }}
                >
                  {waitlisted && pick === plan.id
                    ? 'You are on the waitlist'
                    : on
                      ? `Continue with ${plan.id}`
                      : `Choose ${plan.id}`}
                </button>
              )}
              <ul className={styles.feats}>
                {plan.feats.map((feat) => (
                  <li key={feat}>
                    <Check />
                    {feat}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <div className={styles.compare}>
        <h2 className={styles.compareTitle}>Compare in full</h2>
        <div className={styles.table}>
          <div className={styles.thead}>
            <span>Feature</span>
            {PLANS.map((plan) => (
              <span key={plan.id} className={pick === plan.id ? styles.headOn : undefined}>
                {plan.id}
              </span>
            ))}
          </div>
          {PLAN_MATRIX.map((row) => (
            <div key={row.k} className={styles.trow}>
              <span>{row.k}</span>
              {[row.f, row.p, row.s].map((cell, i) => (
                <span key={PLANS[i]!.id} className={styles.tcell}>
                  {cell === true ? (
                    <Check />
                  ) : cell === false ? (
                    <span className={styles.dash} />
                  ) : (
                    cell
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className={styles.fine}>
          {current === 'Free'
            ? 'Cancel any time. Beta accounts keep free access for a season after Pro launches. Nothing is charged today — Pro and Squad are a waitlist until billing is live.'
            : 'Cancel any time from your account.'}
        </p>
      </div>
    </div>
  );
}
