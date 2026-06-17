import { Link } from "react-router";
import { Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #1E293B, #0F172A)",
          borderRadius: 28, padding: "64px 80px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute", top: -80, right: -80,
            width: 320, height: 320, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
          }}
        />

        <Sparkles size={32} color="#3B82F6" style={{ margin: "0 auto 16px" }} />

        <h2 style={{ fontSize: 36, fontWeight: 800, color: "white", marginBottom: 16, letterSpacing: "-1px" }}>
          Start coloring your animations today
        </h2>

        <p style={{ fontSize: 16, color: "#94A3B8", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
          Join thousands of animators who save hours every week with FrameFlow's AI-powered coloring.
        </p>

        <div className="flex justify-center gap-4 flex-wrap">
          <Link
            to="/signup"
            style={{
              background: "#3B82F6", color: "white",
              padding: "14px 32px", borderRadius: 12,
              fontWeight: 700, fontSize: 15, textDecoration: "none",
              boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
            }}
          >
            Start Free
          </Link>
          <Link
            to="/signin"
            style={{
              background: "rgba(255,255,255,0.08)", color: "white",
              padding: "14px 32px", borderRadius: 12,
              fontWeight: 600, fontSize: 15, textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}