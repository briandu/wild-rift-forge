'use client';

import { useEffect, useState } from 'react';
import type { ApiChampion } from '@/lib/api';
import {
  formatSessionWhen,
  listDraftSessions,
  wipeDraftSessions,
  type DraftSessionSummary,
} from '@/lib/draft-sessions';
import { formatClock } from '@/lib/draft-live';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ChampFace } from './ChampFace';
import styles from './DraftLanding.module.css';

export function DraftSessionList({
  userId,
  champions,
  portraits,
  onOpen,
}: {
  userId: string | null;
  champions: ApiChampion[];
  portraits: Record<string, string>;
  onOpen?: (session: DraftSessionSummary) => void;
}) {
  const [rows, setRows] = useState<DraftSessionSummary[]>([]);
  const [wipe, setWipe] = useState<'idle' | 'ask'>('idle');

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    void listDraftSessions(supabase, userId).then(setRows);
  }, [userId]);

  if (!userId) return null;

  async function wipeAll() {
    if (!userId || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const ok = await wipeDraftSessions(supabase, userId);
    if (ok) {
      setRows([]);
      setWipe('idle');
    }
  }

  return (
    <div className={styles.sessions}>
      <div className={styles.sessionsHead}>
        <div className={styles.label} style={{ marginBottom: 0 }}>
          RECENT SESSIONS
        </div>
        <div className={styles.sessionsMeta}>Saved to your account with the recording</div>
      </div>
      {rows.length === 0 ? (
        <p className={styles.sessionsEmpty}>Finished drafts land here, with a screenshot of the lobby.</p>
      ) : (
        <div className={styles.sessionList}>
          {rows.map((row) => {
            const you = champions.find((champ) => champ.slug === row.youSlug);
            const vs = champions.find((champ) => champ.slug === row.vsSlug);
            return (
              <div key={row.id} className={styles.session}>
                <div className={styles.sessionThumb}>
                  {row.thumbUrl ? (
                    // Signed storage URL for a user-owned capture.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.thumbUrl} alt="" />
                  ) : (
                    <div className={styles.sessionThumbEmpty} />
                  )}
                  {row.mediaKind === 'video' ? (
                    <span className={styles.sessionPlay} aria-hidden>
                      ▶
                    </span>
                  ) : null}
                </div>
                <div className={styles.sessionFaces}>
                  <ChampFace
                    name={you?.name ?? row.youSlug ?? 'You'}
                    slug={row.youSlug ?? undefined}
                    size={30}
                    round="soft"
                    portraits={portraits}
                  />
                  <span className={styles.sessionVs}>vs</span>
                  <ChampFace
                    name={vs?.name ?? row.vsSlug ?? 'Enemy'}
                    slug={row.vsSlug ?? undefined}
                    size={30}
                    round="soft"
                    portraits={portraits}
                  />
                </div>
                <div className={styles.sessionCopy}>
                  <div className={styles.sessionTitle}>
                    {you?.name ?? 'Your pick'} into {vs?.name ?? 'their lane'}
                  </div>
                  <div className={styles.sessionWhen}>
                    {formatSessionWhen(row.createdAt)}
                    {row.durationSeconds != null ? ` · ${formatClock(row.durationSeconds)} in draft` : ''}
                  </div>
                </div>
                {row.outcome ? (
                  <span
                    className={styles.sessionRes}
                    style={{
                      color: row.outcome === 'win' ? '#8FEDB8' : '#E58B7B',
                      background: row.outcome === 'win' ? 'rgba(123,224,168,.14)' : 'rgba(229,139,123,.14)',
                    }}
                  >
                    {row.outcome === 'win' ? 'W' : 'L'}
                  </span>
                ) : null}
                {onOpen ? (
                  <button type="button" className={styles.sessionOpen} onClick={() => onOpen(row)}>
                    Open
                  </button>
                ) : (
                  <a className={styles.sessionOpen} href="/draft">
                    Open
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className={styles.sessionFoot}>
        <div className={styles.sessionsMeta} style={{ flex: '1 1 240px' }}>
          Recordings are kept for 30 days, then deleted automatically.
        </div>
        {wipe === 'idle' ? (
          <button type="button" className={styles.wipe} onClick={() => setWipe('ask')}>
            Delete all draft data
          </button>
        ) : (
          <div className={styles.wipeAsk}>
            <span>Delete every session and recording?</span>
            <button type="button" className={styles.wipeGo} onClick={() => void wipeAll()}>
              Delete
            </button>
            <button type="button" className={styles.wipeKeep} onClick={() => setWipe('idle')}>
              Keep
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
