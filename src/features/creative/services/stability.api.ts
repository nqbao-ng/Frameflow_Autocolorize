import { supabase } from "@/lib/supabase";

export type StabilityImageResponse = {
  ok: true;
  imageDataUrl: string;
  mimeType: string;
  seed?: string | null;
  finishReason?: string | null;
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function requestImage(url: string, payload: Record<string, unknown>): Promise<StabilityImageResponse> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
      const text = data ? null : await response.text().catch(() => "");
      const details = data?.details || data?.error || text || `Request failed (${response.status})`;
      throw new Error(typeof details === "string" ? details : JSON.stringify(details));
    }

    if (!contentType.startsWith("image/")) {
      throw new Error("The generation API returned an unexpected response.");
    }

    const blob = await response.blob();
    return {
      ok: true,
      imageDataUrl: URL.createObjectURL(blob),
      mimeType: blob.type || contentType,
      seed: response.headers.get("x-stability-seed"),
      finishReason: response.headers.get("x-stability-finish-reason"),
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("The generation request timed out. Try a smaller image or retry once.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
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
}

export async function generateSketchConcept(input: {
  imageDataUrl: string;
  prompt: string;
  negativePrompt?: string;
  controlStrength?: number;
  seed?: number | null;
}) {
  return requestImage("/api/stability/sketch", input);
}

export async function expandScene(input: {
  imageDataUrl: string;
  prompt?: string;
  left: number;
  right: number;
  up: number;
  down: number;
  creativity?: number;
  seed?: number | null;
}) {
  return requestImage("/api/stability/outpaint", input);
}

export async function getStabilityBalance() {
  return requestJson<{ ok: boolean; credits: number }>("/api/stability/balance", {
    method: "GET",
  });
}
