import { useCallback, useEffect, useState } from "react";
import { fetchEntitlements, type AccountEntitlements } from "../services/entitlements.api";

let cached: { value: AccountEntitlements; at: number } | null = null;
const CACHE_MS = 15_000;

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<AccountEntitlements | null>(cached?.value || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!force && cached && Date.now() - cached.at < CACHE_MS) {
      setEntitlements(cached.value);
      setLoading(false);
      return cached.value;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await fetchEntitlements();
      cached = { value, at: Date.now() };
      setEntitlements(value);
      return value;
    } catch (loadError) {
      setError((loadError as Error).message || "Unable to load plan usage.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh(true);
    window.addEventListener("frameflow:entitlements-changed", handler);
    return () => window.removeEventListener("frameflow:entitlements-changed", handler);
  }, [refresh]);

  return { entitlements, loading, error, refresh };
}
