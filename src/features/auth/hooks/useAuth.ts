// src/features/auth/hooks/useAuth.ts
//
// Single source of truth cho auth state.
// Pattern giống useProjects.ts / useDashboard.ts.
// UI component chỉ gọi hook này — KHÔNG gọi service trực tiếp.

import { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
