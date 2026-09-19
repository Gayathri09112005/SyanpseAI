import { Suspense } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { Workspace } from '@/features/workspace/Workspace';

export const metadata = { title: 'Workspace — SynapseAI' };

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <Workspace />
      </RequireAuth>
    </Suspense>
  );
}
