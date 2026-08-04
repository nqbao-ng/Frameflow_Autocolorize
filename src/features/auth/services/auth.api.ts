// src/features/auth/services/auth.api.ts
//
// Service layer: wrap toàn bộ Supabase Auth SDK.
// Component và Hook KHÔNG gọi Supabase trực tiếp — chỉ qua file này.
// Sau này đổi backend chỉ cần sửa file này, UI không đổi.

import { supabase } from "@/lib/supabase";
import type { AuthResult, AuthUser, SignInCredentials, SignUpCredentials } from "../types";
import { getAuthErrorMessage, isRetryableAuthError } from "./auth-errors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map Supabase user object → AuthUser (internal shape) */
function mapUser(raw: import("@supabase/supabase-js").User): AuthUser {
  return {
    id:             raw.id,
    email:          raw.email,
    fullName:       // try multiple metadata keys
                    (raw.user_metadata as any)?.full_name || (raw.user_metadata as any)?.fullName || (raw.user_metadata as any)?.name || undefined,
    emailConfirmed: !!raw.email_confirmed_at,
    createdAt:      raw.created_at,
  };
}

/** Fetch profile data from profiles table */
async function fetchProfileData(userId: string): Promise<Partial<AuthUser> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, credits, subscription_plan, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    // If profile doesn't exist yet, return defaults
    if (error || !data) {
      console.warn('[fetchProfileData] Profile not found for user:', userId, error?.message);
      return {
        role: 'user',
        credits: 0,
        subscription_plan: 'free',
      };
    }

    return {
      role: data.role || 'user',
      credits: data.credits ?? 0,
      subscription_plan: data.subscription_plan || 'free',
      avatar_url: data.avatar_url || undefined,
    };
  } catch (err) {
    console.error('[fetchProfileData] Unexpected error:', err);
    return {
      role: 'user',
      credits: 0,
      subscription_plan: 'free',
    };
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/** Đăng nhập bằng email + password */
export async function signIn(credentials: SignInCredentials): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    });

    if (error) {
      return { success: false, error: getAuthErrorMessage(error) };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/** Đăng ký tài khoản mới */
export async function signUp(credentials: SignUpCredentials): Promise<AuthResult> {
  const email = credentials.email.trim().toLowerCase();
  const request = () => supabase.auth.signUp({
    email,
    password: credentials.password,
    options: {
      data: { full_name: credentials.fullName?.trim() ?? "" },
    },
  });

  try {
    let { data, error } = await request();

    // A transient browser/Supabase fetch failure is sometimes surfaced as "{}".
    // Retry this email-scoped operation once, then show a useful error if it persists.
    if (error && isRetryableAuthError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      ({ data, error } = await request());
    }

    if (error) {
      console.error("[signUp] Auth signup failed:", error.message);
      return { success: false, error: getAuthErrorMessage(error) };
    }

    // When email confirmation is enabled, Supabase returns no session.
    return { success: true, needsEmailVerification: !data.session };
  } catch (error) {
    console.error("[signUp] Auth signup request failed:", error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/** Đăng xuất */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Lấy session hiện tại (dùng khi reload app để restore login) */
export async function getSession(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  
  const authUser = mapUser(data.session.user);
  const profileData = await fetchProfileData(data.session.user.id);
  
  return {
    ...authUser,
    ...profileData,
  };
}

/** Subscribe auth state changes (login / logout / token refresh) */
export function onAuthStateChange(
  callback: (user: AuthUser | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    console.log('[onAuthStateChange] Event:', _event, 'Has session:', !!session?.user);
    
    if (!session?.user) {
      console.log('[onAuthStateChange] No session, calling callback(null)');
      callback(null);
      return;
    }

    try {
      console.log('[onAuthStateChange] Fetching profile for user:', session.user.id);
      const authUser = mapUser(session.user);
      const profileData = await fetchProfileData(session.user.id);
      
      const mergedUser = {
        ...authUser,
        ...profileData,
      };
      console.log('[onAuthStateChange] Merged user:', mergedUser);
      callback(mergedUser);
    } catch (err) {
      console.error('[onAuthStateChange] Error in callback:', err);
      callback(null);
    }
  });

  // Return unsubscribe function
  return () => subscription.unsubscribe();
}

/** Update user metadata (profile) */
export async function updateProfile(metadata: Record<string, any>): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ data: metadata });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Update user profile in database */
export async function updateProfileData(
  userId: string,
  data: { full_name?: string; avatar_url?: string }
): Promise<AuthResult> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
