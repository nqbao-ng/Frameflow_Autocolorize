// src/features/auth/services/auth.api.ts
//
// Service layer: wrap toàn bộ Supabase Auth SDK.
// Component và Hook KHÔNG gọi Supabase trực tiếp — chỉ qua file này.
// Sau này đổi backend chỉ cần sửa file này, UI không đổi.

import { supabase } from "@/lib/supabase";
import type { AuthResult, AuthUser, SignInCredentials, SignUpCredentials } from "../types";

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email:    credentials.email,
    password: credentials.password,
  });

  if (error) return { success: false, error: error.message };

   // Verify profile exists for this user (fallback in case trigger didn't create it)
   if (data.user) {
     const { data: existingProfile } = await supabase
       .from('profiles')
       .select('id')
       .eq('id', data.user.id)
       .maybeSingle();

     // If no profile exists, create one
     if (!existingProfile) {
       const fullName = (data.user.user_metadata as any)?.full_name || '';
       const { error: profileError } = await supabase
         .from('profiles')
         .insert({
           id: data.user.id,
           email: data.user.email,
           full_name: fullName,
           role: 'user',
           credits: 0,
           subscription_plan: 'free',
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
         });
       
       if (profileError) {
         console.warn('Failed to create profile during sign in:', profileError);
       }
     }
   }

  return { success: true };
}

/** Đăng ký tài khoản mới */
export async function signUp(credentials: SignUpCredentials): Promise<AuthResult> {
  console.log('[signUp] Creating auth user:', credentials.email);
  
  const { data, error } = await supabase.auth.signUp({
    email:    credentials.email,
    password: credentials.password,
    options: {
      data: { full_name: credentials.fullName ?? "" },
    },
  });

  if (error) {
    console.error('[signUp] Auth signup failed:', error.message);
    return { success: false, error: error.message };
  }

  console.log('[signUp] Auth user created:', data.user?.id);

  // Create profile record (fallback if trigger fails)
  if (data.user) {
    console.log('[signUp] Creating profile for user:', data.user.id);
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: credentials.email,
        full_name: credentials.fullName ?? '',
        role: 'user',
        credits: 0,
        subscription_plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('[signUp] Profile creation failed:', profileError.message);
      // Still return success because user was created in auth
      // Profile will be created on first login if trigger failed
      return { 
        success: true, 
        needsEmailVerification: true,
        // Optional: could return warning here
      };
    }
    
    console.log('[signUp] Profile created successfully');
  }

  // Supabase gửi verification email — user cần xác nhận trước khi login
  return { success: true, needsEmailVerification: true };
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
