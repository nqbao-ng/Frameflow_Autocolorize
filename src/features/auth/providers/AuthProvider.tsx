// src/features/auth/providers/AuthProvider.tsx
//
// Global auth state provider.
// - Restore session khi reload app (getSession)
// - Subscribe auth changes (onAuthStateChange)
// - Expose: user, loading, signIn, signUp, signOut
//
// Wrap toàn App:
//   <AuthProvider>
//     <App />
//   </AuthProvider>

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../services/auth.api";
import type { AuthResult, AuthUser, SignInCredentials, SignUpCredentials } from "../types";

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:    AuthUser | null;
  loading: boolean;

  signIn:  (credentials: SignInCredentials) => Promise<AuthResult>;
  signUp:  (credentials: SignUpCredentials) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (metadata: Record<string, any>) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // true khi đang restore session ban đầu
  const mounted = useRef(true);

   // Restore session khi app load lần đầu + subscribe changes
   useEffect(() => {
     mounted.current = true;
     let unsubscribe: (() => void) | null = null;

    (async () => {
      console.log('[AuthProvider] Restoring session...');
      // 1. Restore existing session
      const existingUser = await authApi.getSession();
      console.log('[AuthProvider] Session restored:', existingUser?.email);
      
      if (mounted.current) {
        setUser(existingUser);
        setLoading(false);
        console.log('[AuthProvider] Loading set to false');
      }

      // 2. Subscribe to future auth changes (login / logout / token refresh)
      // Only subscribe after initial session check
      if (mounted.current) {
        console.log('[AuthProvider] Setting up onAuthStateChange subscription');
        unsubscribe = authApi.onAuthStateChange((updatedUser) => {
          console.log('[AuthProvider] onAuthStateChange callback triggered:', updatedUser?.email);
          if (mounted.current) {
            setUser(updatedUser);
          }
        });
      }
    })();

     return () => {
       mounted.current = false;
       if (unsubscribe) unsubscribe();
     };
   }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const signIn = useCallback(async (credentials: SignInCredentials): Promise<AuthResult> => {
    const result = await authApi.signIn(credentials);
    // user state sẽ tự update qua onAuthStateChange
    return result;
  }, []);

  const signUp = useCallback(async (credentials: SignUpCredentials): Promise<AuthResult> => {
    return authApi.signUp(credentials);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    // user state sẽ tự set null qua onAuthStateChange
  }, []);

  const updateProfile = useCallback(async (metadata: Record<string, any>): Promise<AuthResult> => {
    return authApi.updateProfile(metadata);
  }, []);

  // ─── Value ────────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}