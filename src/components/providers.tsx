import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthProvider from './providers/AuthProvider';
import SyncProvider from './providers/SyncProvider';
import { ToastContainer } from './ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute staleTime matching frontend web
            gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider>
          {children}
          <ToastContainer />
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
