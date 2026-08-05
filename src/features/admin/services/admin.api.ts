import { supabase } from "@/lib/supabase";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  credits: number;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_period_start: string | null;
  subscription_period_end: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminPayment {
  id: string;
  user_id: string;
  order_code: number;
  amount_vnd: number;
  plan_code: string;
  status: string;
  provider: string;
  description: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  payos_reference: string | null;
  error_message: string | null;
  customer_email: string;
  customer_name: string;
  subscription_status: string | null;
  subscription_period_end: string | null;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  admin_id: string;
  transaction_type?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type QueryValue = string | number;

async function request<T>(action: string, init: RequestInit = {}, query: Record<string, QueryValue> = {}): Promise<AdminResult<T>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const params = new URLSearchParams({
      action,
      ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])),
    });
    const response = await fetch(`/api/admin?${params}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.details || payload?.error || `Admin request failed (${response.status})`);
    }
    return { success: true, data: payload.data as T };
  } catch (requestError) {
    return { success: false, error: (requestError as Error).message || "Admin request failed" };
  }
}

export interface UserListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: "all" | "user" | "admin";
  plan?: "all" | "trial" | "free" | "pro" | "studio";
}

export async function getAllUsers(_adminId: string, options: UserListOptions = {}) {
  return request<PagedResult<AdminUser>>("users", {}, {
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    search: options.search || "",
    role: options.role || "all",
    plan: options.plan || "all",
  });
}

export interface PaymentListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "pending" | "paid" | "cancelled" | "expired" | "failed";
}

export async function getPayments(_adminId: string, options: PaymentListOptions = {}) {
  return request<PagedResult<AdminPayment>>("payments", {}, {
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    search: options.search || "",
    status: options.status || "all",
  });
}

export async function getUserDetails(_adminId: string, userId: string) {
  return request<AdminUser>("user", {}, { userId });
}

export async function updateUserRole(_adminId: string, userId: string, newRole: string) {
  return request<void>("role", { method: "PATCH", body: JSON.stringify({ userId, role: newRole }) });
}

export async function adjustCreditsForUser(_adminId: string, userId: string, amount: number, reason: string) {
  return request<void>("credits", { method: "POST", body: JSON.stringify({ userId, amount, reason }) });
}

export async function addCreditsToUser(adminId: string, userId: string, amount: number, reason: string) {
  return adjustCreditsForUser(adminId, userId, Math.abs(amount), reason);
}

export async function deductCreditsFromUser(adminId: string, userId: string, amount: number, reason: string) {
  return adjustCreditsForUser(adminId, userId, -Math.abs(amount), reason);
}

export async function deleteUser(_adminId: string, userId: string) {
  return request<void>("user", { method: "DELETE", body: JSON.stringify({ userId }) });
}

export async function getAuditLogs(_adminId: string, limit = 100) {
  return request<AuditLog[]>("audits", {}, { limit });
}

export async function getUserCreditTransactions(_adminId: string, userId: string, limit = 50) {
  return request<CreditTransaction[]>("transactions", {}, { userId, limit });
}

export type OperationalMetrics = {
  totalUsers: number;
  newUsers30d: number;
  activeUsers: number;
  activeSubscriptions: number;
  paidOrders30d: number;
  pendingPayments: number;
  revenue30dVnd: number;
  revenueAllTimeVnd: number;
  totalCredits: number;
  processingFrames: number;
  creativeCreditsUsed: number;
  estimatedCostUsd: number;
};

export async function getOperationalMetrics(_adminId: string) {
  return request<OperationalMetrics>("metrics");
}

async function metrics() {
  return getOperationalMetrics("");
}

export async function getTotalUserCount(_adminId: string): Promise<AdminResult<number>> {
  const result = await metrics();
  return result.success ? { success: true, data: result.data?.totalUsers || 0 } : { success: false, error: result.error };
}

export async function getTotalCreditsDistributed(_adminId: string): Promise<AdminResult<number>> {
  const result = await metrics();
  return result.success ? { success: true, data: result.data?.totalCredits || 0 } : { success: false, error: result.error };
}

export async function getActiveUsersThisMonth(_adminId: string): Promise<AdminResult<number>> {
  const result = await metrics();
  return result.success ? { success: true, data: result.data?.activeUsers || 0 } : { success: false, error: result.error };
}
