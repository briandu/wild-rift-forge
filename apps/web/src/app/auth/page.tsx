import { Suspense } from 'react';
import { AuthPanel } from '@/components/AuthPanel';
import { Shell } from '@/components/Shell';

export default function AuthPage() {
  return (
    <Shell pathname="/auth" showChrome={false}>
      <Suspense>
        <AuthPanel />
      </Suspense>
    </Shell>
  );
}
