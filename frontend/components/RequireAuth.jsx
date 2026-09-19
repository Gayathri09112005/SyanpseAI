'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useAuth';

export function RequireAuth({ children }) {
  const { data: user, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !user) router.replace('/login');
  }, [isPending, user, router]);

  if (isPending || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  return children;
}
