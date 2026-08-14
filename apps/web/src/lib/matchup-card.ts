import { matchupVerdict } from '@wild-rift-forge/game-data';
import { composeAbilityText } from './abilities';
import type {
  AbilityDto,
  ApiChampion,
  MatchupGuideDto,
  MatchupResponse,
  MatchupSideDto,
} from './api-types';
import { FACE_FALLBACK_BG, roleLabel } from './champions';

export type MatchupChip = { k: string; v: string; c: string };

export type MatchupPhase = { n: string; t: string; c: string; body: string };

export type MatchupAbilityRow = {
  own: boolean;
  k: string;
  n: string;
  note: string;
  imageUrl?: string;
  when?: string;
  then?: string;
  win?: string;
  authored?: boolean;
};

export type MatchupSideCard = {
  slug: string;
  name: string;
  role: string;
  bg: string;
};

export type MatchupModelled = {
  gapLine: string;
  counterWhy: string;
  counterTag: string;
  notes: string[];
};

export type MatchupCard = {
  you: MatchupSideCard;
  them: MatchupSideCard;
  lane: string;
  verdict: string;
  side: 'you' | 'them' | 'even';
  difficulty: string;
  score: number;
  confidence: string;
  sample: string;
  freshness: string;
  rule: string;
  style: string;
  stylePos: number;
  authored: boolean;
  modelled: MatchupModelled;
  quick: MatchupChip[];
  phases: MatchupPhase[];
  abilities: MatchupAbilityRow[];
  spikes: Array<{ at: string; who: 'you' | 'them' | 'even'; label: string }>;
  mistakes: string[];
  tags: string[];
  trades: {
    good: { steps: string[]; out: string };
    bad: { steps: string[]; out: string };
  };
};

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function findChamp(champions: ApiChampion[], slug: string): ApiChampion | undefined {
  return champions.find((champion) => champion.slug === slug);
}

export function sideCard(
  live: MatchupSideDto | undefined,
  slug: string,
  champions: ApiChampion[],
): MatchupSideCard {
  const champ = findChamp(champions, slug);
  const roles = live?.roles ?? champ?.roles ?? [];
  return {
    slug,
    name: live?.name ?? champ?.name ?? titleFromSlug(slug),
    role: roleLabel(roles),
    bg: FACE_FALLBACK_BG,
  };
}

const PHASE_COLORS: Record<string, string> = {
  EARLY: '#E58B7B',
  MID: '#F0A87B',
  LATE: '#8FEDB8',
};

function abilityRows(own: boolean, abilities: AbilityDto[] | undefined): MatchupAbilityRow[] {
  return (abilities ?? []).map((ability) => ({
    own,
    k: ability.key,
    n: ability.name,
    note:
      composeAbilityText(ability.description, ability.numericSummary) ||
      'Kit text is not uploaded for this ability yet.',
    imageUrl: ability.imageUrl,
  }));
}

function authoredAbilityRows(
  notes: MatchupGuideDto['abilityNotes'] | undefined,
  youAbilities: AbilityDto[] | undefined,
  themAbilities: AbilityDto[] | undefined,
): MatchupAbilityRow[] | null {
  if (!notes?.length) {
    return null;
  }
  return notes.map((note) => {
    const kit = (note.own ? youAbilities : themAbilities)?.find((ability) => ability.key === note.k);
    return {
      own: note.own,
      k: note.k,
      n: kit?.name ?? note.k,
      note: note.note,
      when: note.when,
      then: note.then,
      win: note.win,
      authored: true,
      imageUrl: kit?.imageUrl,
    };
  });
}

export function buildMatchupCard(
  live: MatchupResponse | null,
  youSlug: string,
  themSlug: string,
  lane: string,
  champions: ApiChampion[],
): MatchupCard {
  const you = sideCard(live?.you, youSlug, champions);
  const them = sideCard(live?.them, themSlug, champions);
  const side = live?.side ?? 'even';
  const resolvedLane = live?.lane ?? lane;
  const verdict = live?.verdict ?? 'Even matchup';
  const youWr = live?.you.winRate ?? 'unknown';
  const themWr = live?.them.winRate ?? 'unknown';
  const youWrN = parseFloat(live?.you.winRate ?? '');
  const themWrN = parseFloat(live?.them.winRate ?? '');
  const hasRates = Number.isFinite(youWrN) && Number.isFinite(themWrN);
  const gap = hasRates ? +(youWrN - themWrN).toFixed(1) : 0;
  const guide = live?.guide ?? null;
  const rule = guide
    ? guide.oneThing
    : live
      ? `${verdict}. These are ${resolvedLane} win rates, not a head-to-head sample.`
      : 'No ranked snapshot for this pair yet. Pick two champions after stats ingest.';

  return {
    you,
    them,
    lane: resolvedLane,
    verdict: verdict.toUpperCase(),
    side,
    difficulty: live?.difficulty ?? 'Medium',
    score: live?.score ?? 5,
    confidence: live?.confidence ?? 'No snapshot yet',
    sample: live?.sample ?? 'Pairwise games are not in the dataset yet',
    freshness: guide?.patchVersion
      ? `Guide written against ${guide.patchVersion} kits. ${live?.freshness ?? ''}`.trim()
      : live?.freshness ?? 'Waiting on the next stats ingest.',
    rule,
    authored: Boolean(guide),
    modelled: {
      gapLine: hasRates
        ? `${you.name} ${youWrN.toFixed(1)}% · ${them.name} ${themWrN.toFixed(1)}% · ${gap > 0 ? '+' : ''}${gap.toFixed(1)} pts in your favour`
        : 'No ranked snapshot for this pair yet.',
      counterWhy: '',
      counterTag: '',
      notes: [],
    },
    style:
      guide?.style ??
      (side === 'them'
        ? 'CAUTIOUS / SHORT TRADES'
        : side === 'you'
          ? 'PRESS / EXTEND'
          : 'EVEN / PUNISH'),
    stylePos: guide?.stylePos ?? (side === 'them' ? 26 : side === 'you' ? 68 : 50),
    quick: [
      {
        k: 'VERDICT',
        v: verdict,
        c: side === 'them' ? '#E58B7B' : side === 'you' ? '#8FEDB8' : '#F0A87B',
      },
      { k: 'YOU', v: live?.you.winRate ?? '—', c: '#9FCBE4' },
      { k: 'THEM', v: live?.them.winRate ?? '—', c: '#E58B7B' },
      ...(guide
        ? [{ k: 'PLAYSTYLE', v: guide.style.split(' / ')[0] ?? guide.style, c: '#F0A87B' }]
        : []),
    ],
    phases: guide
      ? guide.phases.map((phase) => ({
          n: phase.n,
          t: phase.t,
          c: PHASE_COLORS[phase.n] ?? '#F0A87B',
          body: phase.body,
        }))
      : [
          {
            n: 'EARLY',
            t: 'Levels 1–4',
            c: '#E58B7B',
            body: `Play around the ${resolvedLane} win-rate gap. ${you.name} is at ${youWr} this snapshot; ${them.name} is at ${themWr}.`,
          },
          {
            n: 'MID',
            t: 'Levels 5–10',
            c: '#F0A87B',
            body: 'Track ultimates and the first item spike. The numbers above are lane strength, not a scripted trade.',
          },
          {
            n: 'LATE',
            t: 'Levels 11+',
            c: '#8FEDB8',
            body: 'Stop treating this as a pure duel. Group around the win condition your draft actually has.',
          },
        ],
    abilities:
      authoredAbilityRows(guide?.abilityNotes, live?.abilitiesYou, live?.abilitiesThem) ?? [
        ...abilityRows(true, live?.abilitiesYou),
        ...abilityRows(false, live?.abilitiesThem),
      ],
    spikes: guide?.spikes ?? [],
    mistakes: guide?.mistakes ?? [
      'Reading these lane win rates as a pairwise matchup sample.',
      side === 'them'
        ? `Forcing long fights while ${them.name} holds the ${resolvedLane} rate edge.`
        : side === 'you'
          ? `Playing scared after ${you.name} already has the ${resolvedLane} rate edge.`
          : 'Overcommitting to a duel when the snapshot says the lane is even.',
    ],
    tags:
      guide?.tags ??
      (live?.them.roles ?? findChamp(champions, themSlug)?.roles ?? []).map(
        (role) => role.charAt(0).toUpperCase() + role.slice(1),
      ),
    trades: guide?.trades ?? {
      good: {
        steps: [
          `Respect ${them.name}'s stronger cooldown`,
          'Take a short window',
          'Reset the wave',
          'Do not chase',
        ],
        out: 'You keep the lane playable.',
      },
      bad: {
        steps: [
          'Stand in their threat range',
          'Burn your defensive spell early',
          'Let the fight extend',
          'Die for a cannon',
        ],
        out: 'They take the lane for free.',
      },
    },
  };
}

export function savedLaneVerdict(
  youName: string,
  themName: string,
  youWr?: number,
  themWr?: number,
): { side: 'you' | 'them' | 'even'; verdict: string } {
  if (youWr == null || themWr == null) {
    return { side: 'even', verdict: 'NO LANE SNAPSHOT' };
  }
  const { side } = matchupVerdict(youWr, themWr);
  if (side === 'you') {
    return { side, verdict: `${youName.toUpperCase()} FAVOURED` };
  }
  if (side === 'them') {
    return { side, verdict: `${themName.toUpperCase()} FAVOURED` };
  }
  return { side, verdict: 'EVEN MATCHUP' };
}

export function coachBriefFor(card: MatchupCard): Array<{ n: string; t: string }> {
  const youWr = card.quick.find((chip) => chip.k === 'YOU')?.v ?? '—';
  const themWr = card.quick.find((chip) => chip.k === 'THEM')?.v ?? '—';
  if (!card.authored) {
    return [
      { n: '1', t: card.rule },
      { n: '2', t: `Modelled read only: ${card.modelled.gapLine}.` },
      {
        n: '3',
        t: `${card.you.name} is ${youWr} in ${card.lane} this snapshot; ${card.them.name} is ${themWr}.`,
      },
      {
        n: '4',
        t: 'Written breakdowns cover lane phases, ability windows and build reasoning. Check back shortly while we write this pairing.',
      },
    ];
  }
  return [
    { n: '1', t: card.rule },
    {
      n: '2',
      t: `Play ${card.style.toLowerCase().replace(' / ', ' with ')} off the ${card.lane} snapshot, not a pairwise script.`,
    },
    {
      n: '3',
      t: `${card.you.name} is ${youWr} in ${card.lane} this snapshot; ${card.them.name} is ${themWr}.`,
    },
    {
      n: '4',
      t:
        card.tags.length > 0
          ? `${card.them.name} is tagged ${card.tags.join(', ').toLowerCase()} in the roster. That is role data, not a recommended build.`
          : 'We do not have item or rune advice for this lane yet.',
    },
  ];
}
