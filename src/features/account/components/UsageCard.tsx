import { Link } from "react-router";
import { Clock3, FolderKanban, Gauge, Sparkles } from "lucide-react";
import type { AccountEntitlements } from "../services/entitlements.api";

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const warning = percentage >= 90;
  return (
    <div style={{ height: 6, borderRadius: 999, background: "rgba(148,163,184,.18)", overflow: "hidden", marginTop: 8 }}>
      <div style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, background: warning ? "#FB7185" : "linear-gradient(90deg,#8B5CF6,#EC4899)" }} />
    </div>
  );
}

export function UsageCard({ entitlements, compact = false }: { entitlements: AccountEntitlements; compact?: boolean }) {
  const projectLimit = entitlements.limits.projects;
  const projectUsage = projectLimit == null ? `${entitlements.usage.projects}` : `${entitlements.usage.projects} / ${projectLimit}`;
  const planLabel = entitlements.plan.code === "trial"
    ? `PRO TRIAL · ${entitlements.plan.trialDaysRemaining} day${entitlements.plan.trialDaysRemaining === 1 ? "" : "s"} left`
    : `${entitlements.plan.name.toUpperCase()} PLAN`;
  const items = [
    { icon: FolderKanban, label: "Projects", value: projectUsage, used: entitlements.usage.projects, limit: projectLimit || Math.max(entitlements.usage.projects, 1) },
    { icon: Gauge, label: "Processing Frames", value: `${entitlements.usage.processingFrames} / ${entitlements.limits.processingFrames}`, used: entitlements.usage.processingFrames + entitlements.usage.processingFramesReserved, limit: entitlements.limits.processingFrames },
    { icon: Sparkles, label: "Creative Credits", value: `${entitlements.usage.creativeCreditsRemaining} remaining`, used: entitlements.usage.creativeCredits + entitlements.usage.creativeCreditsReserved, limit: entitlements.limits.creativeCredits },
  ];

  return (
    <section style={{
      border: "1px solid rgba(168,85,247,.3)",
      background: "linear-gradient(135deg,rgba(124,58,237,.17),rgba(236,72,153,.08))",
      borderRadius: 18,
      padding: compact ? 16 : 22,
      color: "#F8FAFC",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: compact ? 12 : 18 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".08em", color: "#C4B5FD", fontWeight: 800 }}>{planLabel}</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock3 size={12} /> Resets {new Date(entitlements.plan.periodEnd).toLocaleDateString("vi-VN")}
          </div>
        </div>
        <Link to="/settings?tab=billing" style={{ textDecoration: "none", color: "white", background: "linear-gradient(135deg,#7C3AED,#EC4899)", padding: "9px 13px", borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
          {entitlements.plan.code === "pro" ? "Manage plan" : "Upgrade to Pro"}
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12 }}>
        {items.map(({ icon: Icon, label, value, used, limit }) => (
          <div key={label} style={{ borderRadius: 13, padding: "12px 13px", background: "rgba(10,10,20,.48)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#AAB2D5", fontSize: 11 }}><Icon size={13} /> {label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>{value}</div>
            <UsageBar used={used} limit={limit} />
          </div>
        ))}
      </div>
    </section>
  );
}
