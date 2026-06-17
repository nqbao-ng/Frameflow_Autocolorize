import { Link } from "react-router";
import { Navbar } from "../components/Navbar";
import {
  Sparkles,
  Brush,
  FileVideo,
  Upload,
  Wand2,
  Download,
  Check,
  ArrowRight,
  Play,
  Zap,
  Twitter,
  Github,
  Youtube,
} from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltZSUyMGFuaW1hdGlvbiUyMGZyYW1lJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcyNzI3ODQzfDA&ixlib=rb-4.1.0&q=80&w=1080";
const ANIM_IMG = "https://images.unsplash.com/photo-1767557125491-b3483567d843?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltYXRpb24lMjBjYXJ0b29uJTIwY2hhcmFjdGVyJTIwZHJhd2luZ3xlbnwxfHx8fDE3NzI3Mjc4NDV8MA&ixlib=rb-4.1.0&q=80&w=1080";

const features = [
  {
    icon: <Sparkles size={28} color="#3B82F6" />,
    title: "AI Auto Color Propagation",
    description:
      "Our AI analyzes your frame sequences and automatically propagates colors across frames, saving hours of tedious manual work.",
    bg: "#EFF6FF",
  },
  {
    icon: <Brush size={28} color="#8B5CF6" />,
    title: "Manual Brush & Smart Correction",
    description:
      "Precise manual brushing tools with AI-powered edge detection and smart color correction for pixel-perfect results.",
    bg: "#F5F3FF",
  },
  {
    icon: <FileVideo size={28} color="#F59E0B" />,
    title: "Export PNG Sequence or MP4",
    description:
      "Export your colored animations in high quality — PNG frame sequences for editing or MP4 for instant sharing.",
    bg: "#FFFBEB",
  },
];

const steps = [
  {
    number: "01",
    icon: <Upload size={32} color="#3B82F6" />,
    title: "Upload Frame Sequence",
    description: "Drop your animation frames or import from your project. Supports PNG, JPG, and PSD sequences.",
    color: "#3B82F6",
  },
  {
    number: "02",
    icon: <Wand2 size={32} color="#8B5CF6" />,
    title: "Add Reference or Let AI Auto Color",
    description: "Provide a color reference image or let FrameFlow's AI intelligently colorize your entire sequence.",
    color: "#8B5CF6",
  },
  {
    number: "03",
    icon: <Download size={32} color="#10B981" />,
    title: "Review & Export",
    description: "Fine-tune individual frames with manual tools, then export as a PNG sequence or MP4 video.",
    color: "#10B981",
  },
];

const freePlanFeatures = ["720p export", "PNG sequence only", "Watermark on export", "Basic AI coloring", "5 projects"];
const proPlanFeatures = ["1080p export", "MP4 & PNG export", "No watermark", "Faster AI processing", "Unlimited projects", "Priority support"];

export function HomePage() {
  return (
    <div style={{ background: "linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 30%)", fontFamily: "'Inter', sans-serif" }}>
      <Navbar />

      {/* Hero Section */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 40px 120px" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div
              className="inline-flex items-center gap-2 mb-6"
              style={{
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 100,
                padding: "6px 16px",
              }}
            >
              <Sparkles size={14} color="#3B82F6" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6" }}>Powered by AI</span>
            </div>

            <h1
              style={{
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1.1,
                color: "#1E293B",
                marginBottom: 24,
                letterSpacing: "-1.5px",
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
                  background: "#3B82F6",
                  color: "white",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(59,130,246,0.35)",
                }}
              >
                <Zap size={16} fill="white" />
                Start Free
              </Link>
              <button
                className="flex items-center gap-2"
                style={{
                  background: "white",
                  color: "#1E293B",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 15,
                  border: "1.5px solid #E2E8F0",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <Play size={16} color="#3B82F6" fill="#3B82F6" />
                Watch Demo
              </button>
            </div>

            <div className="flex items-center gap-6 mt-8">
              {["No credit card required", "Free forever plan", "Export in seconds"].map((text) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Check size={14} color="#10B981" strokeWidth={2.5} />
                  <span style={{ fontSize: 13, color: "#64748B" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right – Dashboard Mockup */}
          <div className="relative hidden lg:block">
            <div
              style={{
                borderRadius: 24,
                overflow: "hidden",
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
                        width: 44,
                        height: 44,
                        borderRadius: 8,
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

            {/* Floating badge */}
            <div
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                background: "white",
                borderRadius: 16,
                padding: "12px 16px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>120 frames colored</span>
            </div>

            <div
              style={{
                position: "absolute",
                bottom: -16,
                left: -16,
                background: "white",
                borderRadius: 16,
                padding: "12px 16px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles size={16} color="#8B5CF6" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>AI Strength: High</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
        <div className="text-center mb-16">
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
            Everything you need to colorize animations
          </h2>
          <p style={{ fontSize: 16, color: "#64748B", maxWidth: 500, margin: "0 auto" }}>
            Professional-grade tools combined with cutting-edge AI to make your workflow faster than ever.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              style={{
                background: "white",
                borderRadius: 20,
                padding: 32,
                boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: feature.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                {feature.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ background: "#F8FAFF", padding: "80px 40px", marginBottom: 120 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="text-center mb-16">
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
              How It Works
            </h2>
            <p style={{ fontSize: 16, color: "#64748B" }}>From raw sketches to fully colored animations in three simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="relative flex flex-col items-center text-center">
                {idx < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px"
                    style={{ background: "linear-gradient(90deg, #CBD5E1, transparent)" }}
                  />
                )}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: `${step.color}15`,
                    border: `2px solid ${step.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.icon}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: step.color,
                    letterSpacing: 2,
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  STEP {step.number}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
        <div className="text-center mb-16">
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
            Simple, Transparent Pricing
          </h2>
          <p style={{ fontSize: 16, color: "#64748B" }}>Start free, upgrade when you need more power.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Plan */}
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 40,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0",
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
              {freePlanFeatures.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={16} color="#94A3B8" />
                  <span style={{ fontSize: 14, color: "#475569" }}>{f}</span>
                </div>
              ))}
            </div>
            <Link
              to="/signup"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px",
                borderRadius: 10,
                border: "1.5px solid #E2E8F0",
                color: "#475569",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div
            style={{
              background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)",
              borderRadius: 20,
              padding: 40,
              boxShadow: "0 10px 40px rgba(59,130,246,0.15)",
              border: "2px solid #3B82F6",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "#3B82F6",
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 100,
                letterSpacing: 0.5,
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
              {proPlanFeatures.map((f) => (
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
                background: "#3B82F6",
                color: "white",
                padding: "12px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
              }}
            >
              Get Pro
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1E293B, #0F172A)",
            borderRadius: 28,
            padding: "64px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: "50%",
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
                background: "#3B82F6",
                color: "white",
                padding: "14px 32px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
              }}
            >
              Start Free
            </Link>
            <Link
              to="/signin"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: "14px 32px",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #E2E8F0", padding: "40px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={14} color="white" fill="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#1E293B" }}>FrameFlow</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              {["Pricing", "Download", "Learn", "Terms", "Privacy"].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{ fontSize: 14, color: "#64748B", textDecoration: "none" }}
                  className="hover:text-blue-500 transition-colors"
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              {[Twitter, Github, Youtube].map((Icon, i) => (
                <a key={i} href="#" style={{ color: "#94A3B8" }} className="hover:text-blue-500 transition-colors">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 13, color: "#94A3B8", marginTop: 28 }}>
            © 2026 FrameFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
