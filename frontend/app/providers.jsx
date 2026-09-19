'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TopNav } from '@/components/TopNav';

export function Providers({ children }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {/* Honours prefers-reduced-motion for every Framer Motion animation. */}
        <MotionConfig reducedMotion="user">
          <TopNav />
          {children}
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
