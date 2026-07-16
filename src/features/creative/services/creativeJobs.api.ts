import { supabase } from "@/lib/supabase";
import type { SketchAnalysisResponse } from "./stability.api";
import { notifyEntitlementsChanged } from "@/features/account/services/entitlements.api";

export type CreativeJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type CreativeJob = {
  id: string;
  jobType: "sketch" | "outpaint";
  status: CreativeJobStatus;
  progress: number;
  projectId?: string | null;
  frameId?: string | null;
  resultUrl?: string | null;
  provider?: string | null;
  modelId?: string | null;
  seed?: string | null;
  error?: string | null;
  attemptCount?: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
  creditCost?: number;
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
      const details = data?.details || data?.error || `Request failed (${response.status})`;
      throw new Error(typeof details === "string" ? details : JSON.stringify(details));
    }
    return data as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("The Creative Studio request timed out. Please retry.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function createCreativeJob(input: {
  jobType: "sketch" | "outpaint";
  imageDataUrl: string;
  prompt?: string | null;
  negativePrompt?: string | null;
  controlStrength?: number;
  stylePreset?: string | null;
  styleId?: string | null;
  visualStyleLabel?: string | null;
  seed?: number | null;
  left?: number;
  right?: number;
  up?: number;
  down?: number;
  creativity?: number;
  sourceName?: string | null;
  projectId?: string | null;
  frameId?: string | null;
  analysis?: SketchAnalysisResponse | null;
}) {
  const response = await requestJson<{ ok: true; job: CreativeJob; creditCost?: number }>("/api/creative/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, 40000);
  notifyEntitlementsChanged();
  return response;
}

export async function getCreativeJob(jobId: string) {
  return requestJson<{ ok: true; job: CreativeJob }>(`/api/creative/job?id=${encodeURIComponent(jobId)}`, {
    method: "GET",
  }, 15000);
}

export async function listCreativeJobs(limit = 12) {
  return requestJson<{ ok: true; jobs: CreativeJob[] }>(`/api/creative/jobs?limit=${Math.max(1, Math.min(30, limit))}`, {
    method: "GET",
  }, 15000);
}

export async function cancelCreativeJob(jobId: string) {
  const response = await requestJson<{ ok: true; job: CreativeJob }>(`/api/creative/job?id=${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  }, 15000);
  notifyEntitlementsChanged();
  return response;
}
