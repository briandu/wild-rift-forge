/**
 * Map Tencent hero_id → English PascalCase id using poster filenames
 * (`.../Posters/Garen_0.jpg` → Garen).
 */
export function parseTencentHeroList(payload: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!payload || typeof payload !== 'object') {
    return map;
  }
  const list = (payload as { heroList?: unknown }).heroList;
  if (!list || typeof list !== 'object') {
    return map;
  }
  for (const value of Object.values(list as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const row = value as { heroId?: unknown; poster?: unknown; id?: unknown };
    const heroId = String(row.heroId ?? '').trim();
    const poster = String(row.poster ?? '');
    const fromPoster = poster.match(/Posters\/([^/_]+)_\d+\./i)?.[1];
    const name = fromPoster ?? (typeof row.id === 'string' ? row.id : '');
    if (heroId && name) {
      map.set(heroId, name);
    }
  }
  return map;
}

/** ry2x WildRift-Champs `hero.json`: hero_id → English id (e.g. Ahri). */
export function parseRy2xHeroMap(payload: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(payload)) {
    return map;
  }
  for (const item of payload) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as { id?: unknown; hero_id?: unknown };
    const id = typeof row.id === 'string' ? row.id : '';
    const heroId = String(row.hero_id ?? '').trim();
    if (id && heroId && heroId !== '0') {
      map.set(heroId, id);
    }
  }
  return map;
}
