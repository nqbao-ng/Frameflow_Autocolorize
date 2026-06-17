import { Link } from "react-router";
import { Sparkles, Zap, Play, Check } from "lucide-react";
import { HERO_IMG, HERO_TRUST_BADGES } from "../constants/homeData";

export function HeroSection() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 40px 120px" }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* Left — copy */}
        <div>
          <div
            className="inline-flex items-center gap-2 mb-6"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 100, padding: "6px 16px" }}
          >
            <Sparkles size={14} color="#3B82F6" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6" }}>Powered by AI</span>
          </div>

          <h1
            style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.1,
              color: "#1E293B", marginBottom: 24, letterSpacing: "-1.5px",
            }}
          >
            AI-Powered
            <br />
            <span style={{ color: "#3B82F6" }}>Animation</span>
            <br />
            Coloring
          </h1>

          <p style={{ fontSize: 18, color: "#475569", lineHeight: 1.7, marginBottom: 40, maxWidth: 480 }}>
            Color entire frame sequences in seconds using AI.
            <br />
            Edit manually when needed.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/signup"
              className="flex items-center gap-2"
              style={{
                background: "#3B82F6", color: "white",
                padding: "14px 28px", borderRadius: 12,
                fontWeight: 700, fontSize: 15, textDecoration: "none",
                boxShadow: "0 8px 24px rgba(59,130,246,0.35)",
              }}
            >
              <Zap size={16} fill="white" />
              Start Free
            </Link>
            <button
              className="flex items-center gap-2"
              style={{
                background: "white", color: "#1E293B",
                padding: "14px 28px", borderRadius: 12,
                fontWeight: 600, fontSize: 15,
                border: "1.5px solid #E2E8F0", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <Play size={16} color="#3B82F6" fill="#3B82F6" />
              Watch Demo
            </button>
          </div>

          <div className="flex items-center gap-6 mt-8">
            {HERO_TRUST_BADGES.map((text) => (
              <div key={text} className="flex items-center gap-1.5">
                <Check size={14} color="#10B981" strokeWidth={2.5} />
                <span style={{ fontSize: 13, color: "#64748B" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — dashboard mockup */}
        <div className="relative hidden lg:block">
          <div
            style={{
              borderRadius: 24, overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.12)",
              border: "1px solid rgba(255,255,255,0.8)",
              background: "#1E293B",
            }}
          >
            {/* Mock titlebar */}
            <div style={{ background: "#0F172A", padding: "12px 16px", display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 11, color: "#64748B", marginLeft: 8 }}>FrameFlow – Magic Girl Animation</span>
            </div>

            <img
              src={HERO_IMG}
              alt="App dashboard preview"
              style={{ width: "100%", height: 340, objectFit: "cover", display: "block" }}
            />

            {/* Mock toolbar overlay */}
            <div style={{ background: "#0F172A", padding: "12px 16px", display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 44, height: 44, borderRadius: 8,
                      background: i === 2 ? "#3B82F6" : "#1E293B",
                      border: i === 2 ? "2px solid #60A5FA" : "1px solid #334155",
                      overflow: "hidden",
                    }}
                  >
                    <img src={HERO_IMG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
                  </div>
                ))}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <div style={{ background: "#3B82F6", borderRadius: 8, padding: "6px 12px" }}>
                  <span style={{ fontSize: 11, color: "white", fontWeight: 600 }}>AI Color</span>
                </div>
                <div style={{ background: "#334155", borderRadius: 8, padding: "6px 12px" }}>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>Export</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div
            style={{
              position: "absolute", top: -16, right: -16,
              background: "white", borderRadius: 16, padding: "12px 16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>120 frames colored</span>
          </div>

          <div
            style={{
              position: "absolute", bottom: -16, left: -16,
              background: "white", borderRadius: 16, padding: "12px 16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Sparkles size={16} color="#8B5CF6" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>AI Strength: High</span>
          </div>
        </div>
      </div>
    </section>
  );
}