import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AlertCircle, Check, CreditCard, Loader2, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import {
  createPayOSCheckout,
  fetchBillingSummary,
  formatVnd,
  type BillingSummary,
} from "./services/billing.api";

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #E8EFFE",
  borderRadius: 16,
  padding: "24px 28px",
  marginBottom: 20,
};

export function BillingPanel() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get("plan");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await fetchBillingSummary());
    } catch (loadError) {
      setError((loadError as Error).message || "Unable to load billing information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activePlan = summary?.profile.planCode || "free";
  const activePlanDefinition = summary?.plans.find((plan) => plan.code === activePlan);
  const activePlanName = activePlanDefinition?.name || "Free";
  const activeUntil = summary?.subscription?.status === "active"
    ? new Date(summary.subscription.currentPeriodEnd).toLocaleDateString("vi-VN")
    : null;

  const checkout = async (planCode: string) => {
    setCheckoutPlan(planCode);
    setError("");
    try {
      const payment = await createPayOSCheckout(planCode);
      if (!payment.checkoutUrl) throw new Error("payOS checkout URL is missing.");
      window.location.assign(payment.checkoutUrl);
    } catch (checkoutError) {
      setError((checkoutError as Error).message || "Unable to start payOS checkout.");
      setCheckoutPlan(null);
    }
  };

  const paidPayments = useMemo(
    () => summary?.payments.filter((payment) => payment.status === "paid") || [],
    [summary?.payments],
  );

  if (loading) {
    return (
      <div style={{ ...card, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#64748B" }}>
        <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /> Loading billing…
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ ...card, background: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={18} />
          <span style={{ flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={() => void load()} style={{ border: "1px solid #FCA5A5", background: "white", borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: "#B91C1C", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <div style={{ ...card, background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)", border: "1px solid #DBEAFE" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 5, textTransform: "uppercase", fontWeight: 700, letterSpacing: ".06em" }}>Current plan</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#1E293B" }}>{activePlanName}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
              {activeUntil ? `Active until ${activeUntil}. Renewing adds another plan period.` : "Free plan with no payment required."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Available credits</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#1E293B" }}>{summary?.profile.credits ?? 0}</div>
            </div>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={27} color="white" fill="white" />
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>Plans</div>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
          Payments are processed securely by payOS using VietQR. The Pro plan is billed monthly and does not auto-renew.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {(summary?.plans || []).map((plan) => {
            const isCurrent = plan.code === activePlan;
            const isRequested = requestedPlan === plan.code;
            const isPaid = plan.priceVnd > 0;
            const isStudio = plan.code === "studio";
            const displayPriceVnd = plan.code === "pro" ? 499000 : plan.priceVnd;
            const isCheckingOut = checkoutPlan === plan.code;
            const isDowngrade = Boolean(
              summary?.subscription?.status === "active"
              && activePlanDefinition
              && plan.sortOrder < activePlanDefinition.sortOrder,
            );
            return (
              <div key={plan.code} style={{
                border: isRequested || isCurrent ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
                borderRadius: 14,
                padding: "20px 18px",
                background: isRequested ? "#EFF6FF" : isCurrent ? "#F8FBFF" : "white",
                position: "relative",
                boxShadow: isRequested ? "0 12px 28px rgba(59,130,246,.12)" : "none",
              }}>
                {isCurrent && (
                  <span style={{ position: "absolute", top: -1, right: 14, fontSize: 10, background: "#3B82F6", color: "white", padding: "3px 9px", borderRadius: "0 0 8px 8px", fontWeight: 700 }}>CURRENT</span>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", marginBottom: 5 }}>{plan.name}</div>
                <div style={{ minHeight: 36, fontSize: 12, color: "#64748B", lineHeight: 1.45, marginBottom: 12 }}>{plan.description}</div>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#1E293B" }}>
                    {isStudio ? "Coming Soon" : formatVnd(displayPriceVnd)}
                  </span>
                  {plan.code === "pro" && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>/month</div>}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 17px" }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ fontSize: 12, color: "#475569", marginBottom: 7, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <Check size={13} color="#10B981" strokeWidth={3} style={{ marginTop: 1, flexShrink: 0 }} /> {feature}
                    </li>
                  ))}
                </ul>
                {isStudio ? (
                  <button
                    type="button"
                    disabled
                    style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: "#CBD5E1", color: "#64748B", fontSize: 13, fontWeight: 700, cursor: "not-allowed" }}
                  >
                    Coming Soon
                  </button>
                ) : isPaid ? (
                  <button
                    onClick={() => void checkout(plan.code)}
                    disabled={Boolean(checkoutPlan) || isDowngrade}
                    style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: isDowngrade ? "#94A3B8" : "#3B82F6", color: "white", fontSize: 13, fontWeight: 700, cursor: checkoutPlan || isDowngrade ? "not-allowed" : "pointer", opacity: checkoutPlan && !isCheckingOut ? .55 : 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}
                  >
                    {isCheckingOut ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <CreditCard size={14} />}
                    {isCheckingOut ? "Opening payOS…" : isDowngrade ? "Available after expiry" : isCurrent ? "Renew with payOS" : "Choose with payOS"}
                  </button>
                ) : (
                  <div style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "1px solid #CBD5E1", color: "#64748B", fontSize: 12, fontWeight: 700, textAlign: "center" }}>No payment required</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18, padding: "11px 13px", borderRadius: 10, background: "#F8FAFC", color: "#64748B", fontSize: 12 }}>
          <ShieldCheck size={15} color="#10B981" /> Plan access is activated only after FrameFlow verifies the signed payOS webhook.
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>Billing history</div>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Your latest payOS payment requests and confirmations.</div>
        {(summary?.payments.length || 0) === 0 ? (
          <div style={{ padding: "18px", borderRadius: 10, background: "#F8FAFC", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>No payment history yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#64748B", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>
                  <th style={{ padding: "9px 8px" }}>Date</th>
                  <th style={{ padding: "9px 8px" }}>Order</th>
                  <th style={{ padding: "9px 8px" }}>Plan</th>
                  <th style={{ padding: "9px 8px" }}>Amount</th>
                  <th style={{ padding: "9px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary?.payments.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: "1px solid #F1F5F9", color: "#334155" }}>
                    <td style={{ padding: "11px 8px" }}>{new Date(payment.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td style={{ padding: "11px 8px", fontFamily: "monospace" }}>{payment.orderCode}</td>
                    <td style={{ padding: "11px 8px", textTransform: "capitalize" }}>{payment.planCode}</td>
                    <td style={{ padding: "11px 8px", fontWeight: 700 }}>{formatVnd(payment.amountVnd)}</td>
                    <td style={{ padding: "11px 8px" }}>
                      <span style={{
                        display: "inline-flex", padding: "3px 8px", borderRadius: 999, fontWeight: 700, textTransform: "capitalize",
                        background: payment.status === "paid" ? "#ECFDF5" : payment.status === "pending" ? "#FFFBEB" : "#FEF2F2",
                        color: payment.status === "paid" ? "#059669" : payment.status === "pending" ? "#B45309" : "#DC2626",
                      }}>{payment.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paidPayments.length > 0 && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 12 }}>Confirmed payments: {paidPayments.length}</div>}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
