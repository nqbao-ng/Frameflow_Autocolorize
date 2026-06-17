// src/features/auth/components/AdminGuard.tsx
//
// Guard cho admin routes: /admin
// - Kiểm tra user có role === 'admin'
// - Nếu không → redirect về /projects

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();

  // Đang khởi tạo / restore session — chờ, không redirect sớm
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F8FF",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid #E2E8F0",
            borderTopColor: "#3B82F6",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Chưa login → redirect về signin
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Không phải admin → redirect về projects
  if (user.role !== "admin") {
    return <Navigate to="/projects" replace />;
  }

  // Đã login và là admin → render children bình thường
  return <>{children}</>;
}