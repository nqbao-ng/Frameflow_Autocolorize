// src/features/auth/types.ts

export interface AuthUser {
  id: string;
  email: string | undefined;
  fullName?: string;
  emailConfirmed: boolean;
  createdAt: string;
  role?: string;
  credits?: number;
  subscription_plan?: string;
  avatar_url?: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  needsEmailVerification?: boolean;
}
