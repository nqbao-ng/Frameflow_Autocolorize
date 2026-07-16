import { supabase } from "@/lib/supabase";

export type StabilityImageResponse = {
  ok: true;
  imageDataUrl: string;
  mimeType: string;
  seed?: string | null;
  finishReason?: string | null;
  modelId?: string | null;
};

export type BedrockStabilityStatus = {
  ok: boolean;
  provider: "amazon-bedrock" | string;
  service: string;
  region: string;
  models: {
    control_sketch: string;
    outpaint: string;
  };
  authentication: string;
  creative_worker?: {
    enabled: boolean;
    queue_configured: boolean;
    supabase_configured: boolean;
    running: boolean;
    queue_region?: string;
  };
};

export type SketchAnalysisResponse = {
  ok: boolean;
  provider: string;
  model_id?: string | null;
  subject: string;
  composition: string;
  preserve_details: string[];
  suggested_palette: string;
  environment: string;
  lighting: string;
  mood: string;
  confidence: number;
  uncertain_details: string[];
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
      throw new Error("The request took too long. Please retry.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function analyzeSketch(input: { imageDataUrl: string; styleHint?: string | null }) {
  return requestJson<SketchAnalysisResponse>("/api/stability/sketch?action=analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }, 40000);
}

export async function getBedrockStabilityStatus() {
  return requestJson<BedrockStabilityStatus>("/api/stability/sketch?action=status", {
    method: "GET",
  }, 15000);
}
