import { supabase } from "@/lib/supabase";

export type AccountEntitlements = {
  plan: {
    code: "trial" | "free" | "pro" | string;
    name: string;
    status: "trialing" | "active" | "expired" | string;
    periodStart: string;
    periodEnd: string;
    trialDaysRemaining: number;
    priceVnd: number;
  };
  limits: {
    projects: number | null;
    processingFrames: number;
    creativeCredits: number;
    creativeConcurrent: number;
    creativeDaily: number;
    versionHistoryDays: number;
  };
  usage: {
    projects: number;
    processingFrames: number;
    processingFramesReserved: number;
    processingFramesRemaining: number;
    creativeCredits: number;
    creativeCreditsReserved: number;
    creativeCreditsRemaining: number;
    activeCreativeJobs: number;
  };
  features: {
    autoColor: boolean;
    manualCorrection: boolean;
    visionAssistIncluded: boolean;
    creativeStudio: boolean;
    priorityQueue: boolean;
    highQualityExport: boolean;
  };
  creativeCosts: {
    sketch: number;
    outpaint: number;
    analyze: number;
  };
  usagePeriodId: string;
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

export async function fetchEntitlements(): Promise<AccountEntitlements> {
  const token = await getAccessToken();
  const response = await fetch("/api/account/entitlements", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const details = data?.details || data?.error || `Unable to load plan usage (${response.status})`;
    throw new Error(typeof details === "string" ? details : JSON.stringify(details));
  }
  return data.entitlements as AccountEntitlements;
}

export function notifyEntitlementsChanged() {
  window.dispatchEvent(new CustomEvent("frameflow:entitlements-changed"));
}
