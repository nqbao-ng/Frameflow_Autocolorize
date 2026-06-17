// src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const globalForSupabase = globalThis as typeof globalThis & {
  supabase?: ReturnType<typeof createClient>;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseKey);

if (import.meta.env.DEV) {
  globalForSupabase.supabase = supabase;
}