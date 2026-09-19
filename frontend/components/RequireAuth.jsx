'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useAuth';
import { useHydrated } from '@/hooks/useHydrated';

export function RequireAuth({ children }) {
  const hydrated = useHydrated();
  const { data: user, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isPending && !user) router.replace('/login');
  }, [hydrated, isPending, user, router]);

  if (!hydrated || isPending || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  return children;
}
