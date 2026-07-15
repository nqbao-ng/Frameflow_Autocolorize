import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { fetchPaymentStatus, type PaymentOrder } from "./services/billing.api";

const TERMINAL = new Set(["paid", "cancelled", "expired", "failed"]);

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const refreshedProfile = useRef(false);
  const orderCode = Number(params.get("orderCode"));
  const returnState = params.get("payment");
  const [payment, setPayment] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      setError("Invalid payment order.");
      setChecking(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const check = async () => {
      attempts += 1;
      try {
        const next = await fetchPaymentStatus(orderCode);
        if (cancelled) return;
        setPayment(next);
        setError("");
        setChecking(false);
        if (!TERMINAL.has(next.status) && attempts < 15) {
          timer = window.setTimeout(check, 2000);
        }
      } catch (statusError) {
        if (cancelled) return;
        setError((statusError as Error).message || "Unable to verify the payment.");
        setChecking(false);
        if (attempts < 5) timer = window.setTimeout(check, 2500);
      }
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderCode]);

  useEffect(() => {
    if (payment?.status === "paid" && !refreshedProfile.current) {
      refreshedProfile.current = true;
      void refreshUser();
    }
  }, [payment?.status, refreshUser]);

  const displayStatus = payment?.status || (returnState === "cancelled" ? "cancelled" : "pending");
  const presentation = useMemo(() => {
    if (displayStatus === "paid") {
      return {
        icon: <CheckCircle2 size={54} color="#10B981" />,
        title: "Payment confirmed",
        message: "Your FrameFlow plan is active and the included credits have been added to your account.",
        tone: "#ECFDF5",
        border: "#A7F3D0",
      };
    }
    if (["cancelled", "expired", "failed"].includes(displayStatus)) {
      return {
        icon: <XCircle size={54} color="#EF4444" />,
        title: displayStatus === "cancelled" ? "Payment cancelled" : "Payment was not completed",
        message: payment?.error || "No charge was applied. You can create a new checkout from Billing.",
        tone: "#FEF2F2",
        border: "#FECACA",
      };
    }
    return {
      icon: checking ? <Loader2 size={50} color="#3B82F6" style={{ animation: "spin 0.8s linear infinite" }} /> : <Clock3 size={50} color="#F59E0B" />,
      title: "Confirming your payment",
      message: "FrameFlow is waiting for the verified payOS webhook. This normally takes only a few seconds.",
      tone: "#FFFBEB",
      border: "#FDE68A",
    };
  }, [checking, displayStatus, payment?.error]);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F8FF", fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <div style={{ height: 64, background: "white", borderBottom: "1px solid #E8EFFE", display: "flex", alignItems: "center", padding: "0 32px" }}>
        <BrandLogo height={34} />
      </div>
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "72px 24px" }}>
        <section style={{ background: "white", border: "1px solid #E8EFFE", borderRadius: 22, padding: 34, boxShadow: "0 24px 70px rgba(37, 99, 235, 0.10)", textAlign: "center" }}>
          <div style={{ width: 82, height: 82, borderRadius: 22, margin: "0 auto 22px", background: presentation.tone, border: `1px solid ${presentation.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {presentation.icon}
          </div>
          <h1 style={{ fontSize: 28, color: "#172033", margin: "0 0 10px", fontWeight: 800 }}>{presentation.title}</h1>
          <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.65, margin: "0 auto 20px", maxWidth: 480 }}>{presentation.message}</p>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 18 }}>{error}</div>}
          {payment && (
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 16px", marginBottom: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left", fontSize: 13 }}>
              <div><span style={{ color: "#94A3B8" }}>Order</span><div style={{ color: "#334155", fontWeight: 700 }}>{payment.orderCode}</div></div>
              <div><span style={{ color: "#94A3B8" }}>Status</span><div style={{ color: "#334155", fontWeight: 700, textTransform: "capitalize" }}>{payment.status}</div></div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/settings?tab=billing")} style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: "#3B82F6", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Open Billing
            </button>
            <button onClick={() => navigate("/projects")} style={{ padding: "11px 20px", borderRadius: 10, border: "1px solid #CBD5E1", background: "white", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Back to Projects
            </button>
          </div>
        </section>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
