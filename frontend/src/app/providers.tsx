import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth';

interface AppProvidersProps {
  children: ReactNode;
}

/** Composes all global providers (auth, etc.) around the app tree. */
export const AppProviders = ({ children }: AppProvidersProps) => (
  <AuthProvider>{children}</AuthProvider>
);
