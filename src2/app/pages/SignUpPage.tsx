import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Zap, Check } from "lucide-react";

export function SignUpPage() {
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/projects");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #F4F8FF 0%, #F0F4FF 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "28px 40px" }}>
        <Link to="/" className="flex items-center gap-2 no-underline" style={{ width: "fit-content" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>FrameFlow</span>
        </Link>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            background: "white",
            borderRadius: 20,
            padding: "40px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.5px", marginBottom: 8 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: "#64748B" }}>Start colorizing animations for free</p>
          </div>

          {/* Benefits */}
          <div style={{ background: "#F8FAFF", borderRadius: 12, padding: "14px 16px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
            {["No credit card required", "5 free projects included", "Export PNG sequences"].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <Check size={14} color="#3B82F6" strokeWidth={2.5} />
                <span style={{ fontSize: 13, color: "#475569" }}>{b}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #E2E8F0",
                  fontSize: 14,
                  color: "#1E293B",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #E2E8F0",
                  fontSize: 14,
                  color: "#1E293B",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{
                    width: "100%",
                    padding: "11px 40px 11px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #E2E8F0",
                    fontSize: 14,
                    color: "#1E293B",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                background: "#3B82F6",
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                marginTop: 4,
                boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Create Free Account
            </button>
          </form>

          <p style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            By signing up, you agree to our{" "}
            <a href="#" style={{ color: "#3B82F6", textDecoration: "none" }}>Terms of Service</a> and{" "}
            <a href="#" style={{ color: "#3B82F6", textDecoration: "none" }}>Privacy Policy</a>.
          </p>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span style={{ fontSize: 14, color: "#64748B" }}>Already have an account? </span>
            <Link to="/signin" style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}