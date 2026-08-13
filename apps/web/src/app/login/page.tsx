import { Suspense } from 'react';
import { AuthPanel } from '@/components/AuthPanel';
import { Shell } from '@/components/Shell';

export default function LoginPage() {
  return (
    <Shell pathname="/login" showChrome={false}>
      <Suspense>
        <AuthPanel />
      </Suspense>
    </Shell>
  );
}
