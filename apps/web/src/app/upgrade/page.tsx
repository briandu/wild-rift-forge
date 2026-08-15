import { UpgradePlans } from '@/components/UpgradePlans';
import { Shell } from '@/components/Shell';
import { PAGE_COPY, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: PAGE_COPY.upgrade.title,
  description: PAGE_COPY.upgrade.description,
  path: '/upgrade',
  index: false,
});

export default function UpgradePage() {
  return (
    <Shell pathname="/upgrade">
      <UpgradePlans />
    </Shell>
  );
}
