'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  signIn: (email: string, password: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: false,
  signIn: () => {},
  signOut: () => {},
});

const DEMO_USER: User = {
  id: 'user_demo_001',
  name: 'Demo User',
  email: 'demo@calibrate.dev',
};

const STORAGE_KEY = 'pulse_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setUser(DEMO_USER);
    }
    setIsLoaded(true);
  }, []);

  const signIn = useCallback(
    (_email: string, _password: string) => {
      localStorage.setItem(STORAGE_KEY, 'true');
      setUser(DEMO_USER);
      router.push('/dashboard');
    },
    [router],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoaded, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
