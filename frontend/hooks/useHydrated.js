'use client';

import { useEffect, useState } from 'react';

/**
 * False during server render and the hydration pass, true afterwards.
 * Session-dependent UI must wait for it: Suspense boundaries hydrate late, by which time the
 * session query may have resolved — rendering it then would not match the server HTML.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
