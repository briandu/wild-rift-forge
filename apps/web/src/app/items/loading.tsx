import { ItemsCatalogSkeleton } from '@/components/ItemsCatalog';
import { Shell } from '@/components/Shell';

export default function Loading() {
  return (
    <Shell pathname="/items" patchLabel="Patch">
      <ItemsCatalogSkeleton />
    </Shell>
  );
}
