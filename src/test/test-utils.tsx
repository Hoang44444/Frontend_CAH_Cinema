import React, { type ReactElement } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ToastProvider } from '@/store/toast';
import { AuthProvider } from '@/store/auth';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...options
  }: {
    initialEntries?: MemoryRouterProps['initialEntries'];
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'> = {},
) {
  function AllTheProviders({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...rtlRender(ui, { wrapper: AllTheProviders, ...options }),
    queryClient,
  };
}
