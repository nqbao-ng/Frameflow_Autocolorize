import { Link } from "react-router";
import { Clock3, Gauge, Sparkles, Zap } from "lucide-react";
import type { AccountEntitlements } from "../services/entitlements.api";

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const warning = percentage >= 90;
  return (
    <div style={{ height: 7, borderRadius: 999, background: "rgba(148,163,184,.18)", overflow: "hidden", marginTop: 9 }}>
      <div
        style={{
          width: `${percentage}%`,
          height: "100%",
          borderRadius: 999,
          background: warning ? "#FB7185" : "linear-gradient(90deg,#8B5CF6,#EC4899)",
          transition: "width .25s ease",
        }}
      />
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, value));
}

export function UsageCard({ entitlements, compact = false }: { entitlements: AccountEntitlements; compact?: boolean }) {
  const planLabel = entitlements.plan.code === "trial"
    ? `PRO TRIAL · ${entitlements.plan.trialDaysRemaining} day${entitlements.plan.trialDaysRemaining === 1 ? "" : "s"} left`
    : `${entitlements.plan.name.toUpperCase()} PLAN`;

  const frameUsed = entitlements.usage.processingFrames + entitlements.usage.processingFramesReserved;
  const frameLimit = entitlements.limits.processingFrames;
  const frameRemaining = entitlements.usage.processingFramesRemaining;
  const creditUsed = entitlements.usage.creativeCredits + entitlements.usage.creativeCreditsReserved;
  const creditLimit = entitlements.limits.creativeCredits;
  const actionLabel = entitlements.plan.code === "pro"
    ? "Manage plan"
    : entitlements.plan.code === "trial"
      ? "Keep Pro"
      : "Upgrade to Pro";

  return (
    <section style={{
      border: "1px solid rgba(168,85,247,.3)",
      background: "linear-gradient(135deg,rgba(124,58,237,.17),rgba(236,72,153,.08))",
      borderRadius: 18,
      padding: compact ? 15 : 22,
      color: "#F8FAFC",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: compact ? 12 : 17 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".08em", color: "#C4B5FD", fontWeight: 800 }}>{planLabel}</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock3 size={12} /> Resets {new Date(entitlements.plan.periodEnd).toLocaleDateString("vi-VN")}
          </div>
        </div>
        <Link
          to={`/settings?tab=billing${entitlements.plan.code === "pro" ? "" : "&plan=pro"}`}
          style={{ textDecoration: "none", color: "white", background: "linear-gradient(135deg,#7C3AED,#EC4899)", padding: "9px 13px", borderRadius: 10, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}
        >
          {actionLabel}
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0,1.65fr) minmax(220px,.85fr)", gap: 12 }}>
        <div style={{ borderRadius: 14, padding: compact ? "13px" : "15px 16px", background: "rgba(10,10,20,.54)", border: "1px solid rgba(255,255,255,.09)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#C4B5FD", fontSize: 11, fontWeight: 800 }}>
              <Gauge size={15} /> PROCESSING FRAMES
            </div>
            {entitlements.usage.processingFramesReserved > 0 && (
              <span style={{ fontSize: 10, color: "#FDE68A", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Zap size={11} /> {entitlements.usage.processingFramesReserved} reserved
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <strong style={{ fontSize: compact ? 23 : 30, lineHeight: 1 }}>{formatNumber(frameRemaining)}</strong>
            <span style={{ color: "#AAB2D5", fontSize: 12 }}>remaining of {formatNumber(frameLimit)} / month</span>
          </div>
          <UsageBar used={frameUsed} limit={frameLimit} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, color: "#7E86A4", fontSize: 10 }}>
            <span>{formatNumber(entitlements.usage.processingFrames)} processed</span>
            <span>{Math.min(100, Math.round((frameUsed / Math.max(1, frameLimit)) * 100))}% used</span>
          </div>
        </div>

        <div style={{ borderRadius: 14, padding: "13px 14px", background: "rgba(10,10,20,.48)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#AAB2D5", fontSize: 11 }}><Sparkles size={13} /> Creative Credits</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 7 }}>{formatNumber(entitlements.usage.creativeCreditsRemaining)} remaining</div>
          <div style={{ color: "#7E86A4", fontSize: 10, marginTop: 3 }}>of {formatNumber(creditLimit)} / month</div>
          <UsageBar used={creditUsed} limit={creditLimit} />
        </div>
      </div>
    </section>
  );
}
