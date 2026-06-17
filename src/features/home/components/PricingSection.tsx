import { Link } from "react-router";
import { Check, ArrowRight } from "lucide-react";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "../constants/homeData";

export function PricingSection() {
  return (
    <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
      <div className="text-center mb-16">
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
          Simple, Transparent Pricing
        </h2>
        <p style={{ fontSize: 16, color: "#64748B" }}>
          Start free, upgrade when you need more power.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

        {/* Free Plan */}
        <div
          style={{
            background: "white", borderRadius: 20, padding: 40,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Free Plan
            </p>
            <div className="flex items-baseline gap-1">
              <span style={{ fontSize: 40, fontWeight: 800, color: "#1E293B" }}>$0</span>
              <span style={{ fontSize: 14, color: "#94A3B8" }}>/month</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {FREE_PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check size={16} color="#94A3B8" />
                <span style={{ fontSize: 14, color: "#475569" }}>{f}</span>
              </div>
            ))}
          </div>

          <Link
            to="/signup"
            style={{
              display: "block", textAlign: "center", padding: "12px",
              borderRadius: 10, border: "1.5px solid #E2E8F0",
              color: "#475569", fontWeight: 600, fontSize: 14, textDecoration: "none",
            }}
          >
            Get Started Free
          </Link>
        </div>

        {/* Pro Plan */}
        <div
          style={{
            background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)",
            borderRadius: 20, padding: 40,
            boxShadow: "0 10px 40px rgba(59,130,246,0.15)",
            border: "2px solid #3B82F6",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Popular badge */}
          <div
            style={{
              position: "absolute", top: 20, right: 20,
              background: "#3B82F6", color: "white",
              fontSize: 11, fontWeight: 700,
              padding: "4px 10px", borderRadius: 100, letterSpacing: 0.5,
            }}
          >
            POPULAR
          </div>

          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Pro Plan
            </p>
            <div className="flex items-baseline gap-1">
              <span style={{ fontSize: 40, fontWeight: 800, color: "#1E293B" }}>$20</span>
              <span style={{ fontSize: 14, color: "#94A3B8" }}>/month</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {PRO_PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check size={16} color="#3B82F6" strokeWidth={2.5} />
                <span style={{ fontSize: 14, color: "#1E293B", fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>

          <Link
            to="/signup"
            className="flex items-center justify-center gap-2"
            style={{
              background: "#3B82F6", color: "white",
              padding: "12px", borderRadius: 10,
              fontWeight: 700, fontSize: 14, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
            }}
          >
            Get Pro
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}