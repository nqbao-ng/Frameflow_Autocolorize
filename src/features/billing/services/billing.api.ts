import { supabase } from "@/lib/supabase";
import type { AccountEntitlements } from "@/features/account/services/entitlements.api";

export type BillingPlan = {
  code: string;
  name: string;
  description: string;
  priceVnd: number;
  durationDays: number;
  creditsGrant: number;
  projectLimit: number | null;
  processingFrameLimit: number;
  creativeCreditLimit: number;
  creativeDailyLimit: number;
  creativeConcurrentLimit: number;
  trialDays: number;
  priorityQueue: boolean;
  highQualityExport: boolean;
  versionHistoryDays: number;
  sortOrder: number;
  features: string[];
};

export type PaymentOrder = {
  id: string;
  orderCode: number;
  planCode: string;
  amountVnd: number;
  creditsGrant: number;
  durationDays: number;
  status: "pending" | "paid" | "cancelled" | "expired" | "failed";
  checkoutUrl?: string | null;
  paymentLinkId?: string | null;
  reference?: string | null;
  error?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingSummary = {
  ok: true;
  plans: BillingPlan[];
  entitlements: AccountEntitlements;
  profile: { credits: number; planCode: string };
  subscription: {
    planCode: string;
    status: "active" | "expired" | "cancelled";
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  payments: PaymentOrder[];
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const details = data?.details || data?.error || `Request failed (${response.status})`;
    throw new Error(typeof details === "string" ? details : JSON.stringify(details));
  }
  return data as T;
}

export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  const response = await fetch("/api/billing?action=plans", { headers: { Accept: "application/json" } });
  const data = await parseResponse<{ ok: true; plans: BillingPlan[] }>(response);
  return data.plans;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const token = await getAccessToken();
  const response = await fetch("/api/billing?action=summary", { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  return parseResponse<BillingSummary>(response);
}

export async function createPayOSCheckout(planCode: string): Promise<PaymentOrder> {
  const token = await getAccessToken();
  const response = await fetch("/api/billing?action=create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ planCode }),
  });
  const data = await parseResponse<{ ok: true; payment: PaymentOrder }>(response);
  return data.payment;
}

export async function fetchPaymentStatus(orderCode: number): Promise<PaymentOrder> {
  const token = await getAccessToken();
  const response = await fetch(`/api/billing?action=status&orderCode=${encodeURIComponent(orderCode)}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const data = await parseResponse<{ ok: true; payment: PaymentOrder }>(response);
  return data.payment;
}

export function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}
