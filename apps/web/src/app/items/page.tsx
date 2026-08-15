import { ItemsCatalog } from '@/components/ItemsCatalog';
import { Shell } from '@/components/Shell';
import { fetchChampions, fetchLatestPatch } from '@/lib/api';
import { portraitsFromRoster } from '@/lib/champions';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.items.title,
  description: PAGE_COPY.items.description,
  path: '/items',
});

export default async function ItemsPage() {
  const [patch, roster] = await Promise.all([fetchLatestPatch(), fetchChampions()]);
  return (
    <Shell pathname="/items">
      <ItemsCatalog
        patchVersion={patch?.patch.version ?? null}
        portraits={portraitsFromRoster(roster)}
      />
    </Shell>
  );
}
