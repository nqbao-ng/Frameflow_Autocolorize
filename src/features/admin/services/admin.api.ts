// src/features/admin/services/admin.api.ts
//
// Admin API service for managing users, credits, and audit logs.
// Only accessible to admin users (role === 'admin').

import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  credits: number;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  admin_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id?: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AdminResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Helper: Log admin action ──────────────────────────────────────────────────

async function logAuditAction(
  adminId: string,
  action: string,
  targetUserId?: string,
  details?: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId,
      details: details || {},
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.warn('Failed to log audit action:', error);
  }
}

// ─── Admin API ─────────────────────────────────────────────────────────────────

/**
 * Get all users with their profiles (admin only)
 */
export async function getAllUsers(
  adminId: string
): Promise<AdminResult<AdminUser[]>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Fetch all users from profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as AdminUser[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users';
    return { success: false, error: message };
  }
}

/**
 * Get detailed info for a specific user
 */
export async function getUserDetails(
  adminId: string,
  userId: string
): Promise<AdminResult<AdminUser>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as AdminUser };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user';
    return { success: false, error: message };
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  adminId: string,
  userId: string,
  newRole: string
): Promise<AdminResult<void>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    await logAuditAction(adminId, 'UPDATE_USER_ROLE', userId, { newRole });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update user role';
    return { success: false, error: message };
  }
}

/**
 * Add credits to user's account
 */
export async function addCreditsToUser(
  adminId: string,
  userId: string,
  amount: number,
  reason: string
): Promise<AdminResult<void>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Get current credits
    const { data: userProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (fetchError) return { success: false, error: fetchError.message };

    const currentCredits = userProfile?.credits ?? 0;
    const newCredits = currentCredits + amount;

    // Update credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) return { success: false, error: updateError.message };

    // Log transaction
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount,
        reason,
        admin_id: adminId,
        created_at: new Date().toISOString(),
      });

    if (txError) console.warn('Failed to log credit transaction:', txError);

    await logAuditAction(adminId, 'ADD_CREDITS', userId, { amount, reason });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add credits';
    return { success: false, error: message };
  }
}

/**
 * Deduct credits from user's account
 */
export async function deductCreditsFromUser(
  adminId: string,
  userId: string,
  amount: number,
  reason: string
): Promise<AdminResult<void>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Get current credits
    const { data: userProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (fetchError) return { success: false, error: fetchError.message };

    const currentCredits = userProfile?.credits ?? 0;
    const newCredits = Math.max(0, currentCredits - amount);

    // Update credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) return { success: false, error: updateError.message };

    // Log transaction
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        reason,
        admin_id: adminId,
        created_at: new Date().toISOString(),
      });

    if (txError) console.warn('Failed to log credit transaction:', txError);

    await logAuditAction(adminId, 'DEDUCT_CREDITS', userId, { amount, reason });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deduct credits';
    return { success: false, error: message };
  }
}

/**
 * Delete user account (admin only)
 */
export async function deleteUser(
  adminId: string,
  userId: string
): Promise<AdminResult<void>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Prevent admin self-deletion
    if (userId === adminId) {
      return { success: false, error: 'Cannot delete your own admin account' };
    }

    // Delete user profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    await logAuditAction(adminId, 'DELETE_USER', userId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    return { success: false, error: message };
  }
}

/**
 * Get audit logs (admin only)
 */
export async function getAuditLogs(
  adminId: string,
  limit: number = 100
): Promise<AdminResult<AuditLog[]>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as AuditLog[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
    return { success: false, error: message };
  }
}

/**
 * Get credit transactions for a user
 */
export async function getUserCreditTransactions(
  adminId: string,
  userId: string,
  limit: number = 50
): Promise<AdminResult<CreditTransaction[]>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as CreditTransaction[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
    return { success: false, error: message };
  }
}

/**
 * Get total user count (admin only)
 */
export async function getTotalUserCount(
  adminId: string
): Promise<AdminResult<number>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) return { success: false, error: error.message };

    return { success: true, data: count || 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user count';
    return { success: false, error: message };
  }
}

/**
 * Get total credits distributed across all users (admin only)
 */
export async function getTotalCreditsDistributed(
  adminId: string
): Promise<AdminResult<number>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('credits');

    if (error) return { success: false, error: error.message };

    const total = (data as any[] || []).reduce((sum, profile) => sum + (profile.credits || 0), 0);

    return { success: true, data: total };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch total credits';
    return { success: false, error: message };
  }
}

/**
 * Get users active in the last 30 days (admin only)
 */
export async function getActiveUsersThisMonth(
  adminId: string
): Promise<AdminResult<number>> {
  try {
    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Get date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Check updated_at to determine active users
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgoISO);

    if (error) return { success: false, error: error.message };

    return { success: true, data: count || 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch active users';
    return { success: false, error: message };
  }
}
