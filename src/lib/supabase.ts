// src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";

function requirePublicEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[FrameFlow configuration] ${name} is missing. ` +
      "Add it to the Vercel environment and redeploy the application."
    );
  }

  return value;
}

const supabaseUrl = requirePublicEnv("VITE_SUPABASE_URL");
const supabaseKey = requirePublicEnv("VITE_SUPABASE_ANON_KEY");
let supabaseOrigin = "";

try {
  const parsedUrl = new URL(supabaseUrl);
  supabaseOrigin = parsedUrl.origin;
  if (parsedUrl.protocol !== "https:" && !import.meta.env.DEV) {
    throw new Error("Production Supabase URLs must use HTTPS.");
  }
} catch (error) {
  const detail = error instanceof Error ? error.message : "Invalid URL";
  throw new Error(
    `[FrameFlow configuration] VITE_SUPABASE_URL is invalid: ${detail}`
  );
}

/**
 * Supabase Auth normally talks to the project domain directly. Some browser
 * networks and blockers reject that cross-origin request before Supabase can
 * answer. In that one case, retry the same Auth request through FrameFlow's
 * same-origin Vercel function. Database and Storage requests remain direct.
 */
async function fetchWithAuthFallback(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const directRequest = new Request(input, init);
  const target = new URL(directRequest.url);
  const isAuthRequest =
    target.origin === supabaseOrigin && target.pathname.startsWith("/auth/v1/");

  if (!isAuthRequest) return globalThis.fetch(directRequest);

  const fallbackRequest = directRequest.clone();
  try {
    return await globalThis.fetch(directRequest);
  } catch (directError) {
    const appOrigin = globalThis.location?.origin;
    if (!appOrigin) throw directError;

    const proxyUrl = new URL("/api/auth", appOrigin);
    proxyUrl.searchParams.set("path", `${target.pathname}${target.search}`);
    const method = fallbackRequest.method.toUpperCase();
    const body = ["GET", "HEAD"].includes(method)
      ? undefined
      : await fallbackRequest.arrayBuffer();

    try {
      return await globalThis.fetch(proxyUrl, {
        method,
        headers: fallbackRequest.headers,
        credentials: "same-origin",
        ...(body !== undefined ? { body } : {}),
      });
    } catch (proxyError) {
      throw new Error("FrameFlow authentication fallback could not be reached", {
        cause: proxyError instanceof Error ? proxyError : directError,
      });
    }
  }
}

const globalForSupabase = globalThis as typeof globalThis & {
  supabase?: ReturnType<typeof createClient<any>>;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient<any>(supabaseUrl, supabaseKey, {
    global: { fetch: fetchWithAuthFallback },
  });

if (import.meta.env.DEV) {
  globalForSupabase.supabase = supabase;
}
