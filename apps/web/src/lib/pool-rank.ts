export const POOL_SORTS = ['Custom', 'Win rate', 'Games played'] as const;
export type PoolSort = (typeof POOL_SORTS)[number];

export function sortPool(
  slugs: string[],
  sort: PoolSort,
  winRate: (slug: string) => number,
  volume: (slug: string) => number,
): string[] {
  if (sort === 'Custom') return [...slugs];
  const copy = [...slugs];
  if (sort === 'Win rate') {
    copy.sort((a, b) => winRate(b) - winRate(a) || a.localeCompare(b));
  } else {
    copy.sort((a, b) => volume(b) - volume(a) || a.localeCompare(b));
  }
  return copy;
}

export function movePoolItem(slugs: string[], slug: string, dir: -1 | 1): string[] {
  const i = slugs.indexOf(slug);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= slugs.length) return slugs;
  const next = [...slugs];
  const current = next[i];
  const swap = next[j];
  if (current === undefined || swap === undefined) return slugs;
  next[i] = swap;
  next[j] = current;
  return next;
}

export function mergeLaneOrder(
  full: string[],
  sortedLane: string[],
  inLane: (slug: string) => boolean,
): string[] {
  const queue = [...sortedLane];
  return full.map((slug) => (inLane(slug) ? (queue.shift() ?? slug) : slug));
}

export function poolScopeLabel(lane: string): string {
  return lane === 'All' ? 'every lane' : `the ${lane.toLowerCase()} lane`;
}

export function poolSortHint(sort: PoolSort, scope: string, riotConnected: boolean): string {
  if (sort === 'Custom') {
    return `Order is priority: the champion at #1 in a lane is the one Forge assumes you will play, so their matchups load first. Use the arrows on a card to move it, and switch to a ranking to sort ${scope} automatically.`;
  }
  if (sort === 'Win rate') {
    return `Ranked by this patch's win rate across ${scope}. Nothing has changed yet — save the order to keep it.`;
  }
  if (riotConnected) {
    return `Your match history is not in yet. This order is estimated from ranked play across ${scope}. Nothing has changed yet — save the order to keep it.`;
  }
  return `Connect a Riot ID to rank by your own games. Until then this order is estimated from ranked play across ${scope}.`;
}
