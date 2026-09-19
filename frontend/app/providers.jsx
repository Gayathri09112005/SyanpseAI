'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TopNav } from '@/components/TopNav';

export function Providers({ children }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TopNav />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
