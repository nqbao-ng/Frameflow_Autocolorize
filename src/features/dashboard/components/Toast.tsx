import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function Toast({ toasts, onRemove }: ToastProps) {
  useEffect(() => {
    const timers = toasts.map((toast) => {
      const duration = toast.duration ?? 3000;
      return setTimeout(() => onRemove(toast.id), duration);
    });

    return () => timers.forEach(clearTimeout);
  }, [toasts, onRemove]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            background:
              toast.type === "success"
                ? "#ECFDF5"
                : toast.type === "error"
                  ? "#FEF2F2"
                  : "#F0F9FF",
            border:
              toast.type === "success"
                ? "1px solid #D1FAE5"
                : toast.type === "error"
                  ? "1px solid #FECACA"
                  : "1px solid #BAE6FD",
            minWidth: 280,
            maxWidth: 400,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          {toast.type === "success" && (
            <CheckCircle size={20} color="#10B981" />
          )}
          {toast.type === "error" && <AlertCircle size={20} color="#EF4444" />}
          {toast.type === "info" && <Info size={20} color="#0EA5E9" />}

          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color:
                toast.type === "success"
                  ? "#065F46"
                  : toast.type === "error"
                    ? "#7F1D1D"
                    : "#0C4A6E",
            }}
          >
            {toast.message}
          </span>

          <button
            onClick={() => onRemove(toast.id)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color:
                toast.type === "success"
                  ? "#065F46"
                  : toast.type === "error"
                    ? "#7F1D1D"
                    : "#0C4A6E",
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}