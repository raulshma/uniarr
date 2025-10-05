import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react';

import { getClerkErrorMessage, mapClerkUser, type AuthUser } from '@/services/auth/AuthService';
import { logger } from '@/services/logger/LoggerService';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren): ReactElement => {
  const { isLoaded: isAuthLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { isLoaded: isUserLoaded, user: clerkUser } = useUser();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const signOut = useCallback(async () => {
    if (!isAuthLoaded) {
      return;
    }

    setIsTransitioning(true);

    try {
      await clerkSignOut();
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        'Unable to sign out. Please try again in a moment.',
      );

      void logger.error('Failed to sign out.', {
        location: 'AuthProvider.signOut',
        error: error instanceof Error ? error.message : String(error),
      });

      setIsTransitioning(false);
      throw new Error(message);
    }

    setIsTransitioning(false);
  }, [clerkSignOut, isAuthLoaded]);

  const user = useMemo(() => mapClerkUser(clerkUser), [clerkUser]);
  const isLoading = !isAuthLoaded || !isUserLoaded || isTransitioning;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(isSignedIn),
      isLoading,
      signOut,
    }),
    [user, isSignedIn, isLoading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
