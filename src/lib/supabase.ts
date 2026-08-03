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

try {
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== "https:" && !import.meta.env.DEV) {
    throw new Error("Production Supabase URLs must use HTTPS.");
  }
} catch (error) {
  const detail = error instanceof Error ? error.message : "Invalid URL";
  throw new Error(
    `[FrameFlow configuration] VITE_SUPABASE_URL is invalid: ${detail}`
  );
}

const globalForSupabase = globalThis as typeof globalThis & {
  supabase?: ReturnType<typeof createClient<any>>;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient<any>(supabaseUrl, supabaseKey);

if (import.meta.env.DEV) {
  globalForSupabase.supabase = supabase;
}
