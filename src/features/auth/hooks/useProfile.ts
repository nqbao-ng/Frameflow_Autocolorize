// src/features/auth/hooks/useProfile.ts
//
// Hook to manage user profile data from the 'profiles' table.
// - Fetch profile by user ID
// - Update profile data
// - Handle loading/error states

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  credits: number;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: Pick<Partial<UserProfile>, "full_name" | "avatar_url">) => Promise<boolean>;
}

/**
 * Fetch and manage user profile from 'profiles' table
 * @param userId - The user ID to fetch profile for
 */
export function useProfile(userId: string | null): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile from Supabase
  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Profile not found — this is okay, it might be created later
          setProfile(null);
          setError(null);
        } else {
          setError(fetchError.message);
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch profile on mount or when userId changes
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Update profile
  const updateProfile = useCallback(
    async (updates: Pick<Partial<UserProfile>, "full_name" | "avatar_url">): Promise<boolean> => {
      if (!userId) {
        setError('User ID is required to update profile');
        return false;
      }

      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          setError(updateError.message);
          return false;
        }

        // Refresh local state
        await fetchProfile();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update profile';
        setError(message);
        return false;
      }
    },
    [userId, fetchProfile]
  );

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
}