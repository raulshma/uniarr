import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react';

interface StubUser {
  id: string;
  email?: string;
}

interface AuthContextValue {
  user: StubUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const simulateNetworkDelay = async (durationMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

export const AuthProvider = ({ children }: PropsWithChildren): ReactElement => {
  const [user, setUser] = useState<StubUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      // Temporary placeholder implementation. Replace with Clerk integration in TASK-029.
      await simulateNetworkDelay(400);
      setUser({ id: 'stub-user', email: 'stub@uniarr.dev' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await simulateNetworkDelay(250);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signIn,
      signOut,
    }),
    [user, isLoading, signIn, signOut],
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
