import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { authApi, isLoggedIn, setAuthErrorHandler, type AuthUser } from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    } else { setLoading(false); }
    setAuthErrorHandler(() => setUser(null));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try { setError(null); const u = await authApi.login(email, password); setUser(u); }
    catch (err: any) { setError(err.message || "Erro ao fazer login"); throw err; }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try { setError(null); const u = await authApi.register(name, email, password); setUser(u); }
    catch (err: any) { setError(err.message || "Erro ao criar conta"); throw err; }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { setUser(null); }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // CRITICAL: memoize value so children don't re-render unless actual data changes
  const value = useMemo(() => ({
    user, loading, isAuthenticated: !!user, isAdmin: !!(user as any)?.isAdmin,
    signIn, signUp, logout, error, clearError,
  }), [user, loading, error, signIn, signUp, logout, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
