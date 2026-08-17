import type { PlanId } from './plans';

export const DRAFT_MODES = ['Ranked', 'Normal', 'Tournament'] as const;
export type DraftMode = (typeof DRAFT_MODES)[number];

export type DraftPhase = 'gated' | 'ready' | 'live';

export const SAVE_GATE_GETS = [
  {
    k: 'This matchup, one tap away',
    v: 'Saved pairings sit on your home screen, so the plan is up before the loading screen ends.',
  },
  {
    k: 'Told when it changes',
    v: 'We flag your saved lanes when a patch moves the numbers, instead of you finding out mid-game.',
  },
  {
    k: 'Your pool, weighted',
    v: 'Suggestions lean on the champions you actually play once your pool is set.',
  },
] as const;

export const DRAFT_GATE_GETS = [
  {
    k: 'Live pick weighting',
    v: 'Every suggestion is re-scored against what the enemy has locked, not against a static tier list.',
  },
  {
    k: 'Your own history',
    v: 'Fit scores lean on your games on that champion, so the board recommends what you can actually play.',
  },
  {
    k: 'Champion select overlay',
    v: 'The board sits inside the client and fills picks in as the lobby moves.',
  },
  {
    k: 'Matchup brief on lock',
    v: 'Commit a pick and the board becomes trades, spikes and the one rule that decides the lane.',
  },
] as const;

export const DRAFT_GATE_FREE = [
  { k: 'Counter lookups', href: '/' },
  { k: 'Matchup guides', href: '/matchups' },
  { k: 'Tier list', href: '/tier' },
] as const;

export const DRAFT_READY_STEPS = [
  {
    n: '1',
    k: 'Lock their picks as they appear',
    v: 'Tap an enemy slot and we weigh every remaining answer against what they have already committed to.',
  },
  {
    n: '2',
    k: 'Read the fit score',
    v: 'Each suggestion is scored on the matchup, your team’s damage profile and your own history on that champion.',
  },
  {
    n: '3',
    k: 'Take the plan into lane',
    v: 'Once you lock, the board becomes a matchup brief — trades, spikes, and the one rule that decides the lane.',
  },
] as const;

export const DRAFT_TEASE_SLUGS = ['volibear', 'renekton', 'gwen'] as const;

/**
 * Live pick scoring is Pro. Free accounts see the gate.
 * A non-empty local board still resumes so an in-progress lobby is not stranded.
 */
export function draftPhase(
  plan: PlanId,
  started: boolean,
  resumeBoard = false,
): DraftPhase {
  if (resumeBoard) return 'live';
  if (plan === 'Free') return 'gated';
  return started ? 'live' : 'ready';
}
