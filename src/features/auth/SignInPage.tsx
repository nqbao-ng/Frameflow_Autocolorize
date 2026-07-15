import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { BrandLogo } from "@/shared/components/BrandLogo";

export function SignInPage() {
  const [showPass, setShowPass] = useState(false);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const { signIn, user } = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  // Redirect user after successful login when user data is available
  useEffect(() => {
    if (justLoggedIn && user) {
      console.log('[SignInPage] User loaded:', user.email, 'Role:', user.role);
      
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        navigate(redirectTo);
      } else if (user.role === 'admin') {
        console.log('[SignInPage] Redirecting admin to /admin');
        navigate("/admin");
      } else {
        console.log('[SignInPage] Redirecting user to /projects');
        navigate("/projects");
      }
      setJustLoggedIn(false);
    }
  }, [justLoggedIn, user, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log('[SignInPage] Submitting login for:', email);

    const result = await signIn({ email, password });
    console.log('[SignInPage] signIn result:', result);

    setLoading(false);

    if (!result.success) {
      console.error('[SignInPage] Sign in failed:', result.error);
      setError(result.error ?? "Invalid email or password.");
      return;
    }

    console.log('[SignInPage] Sign in successful, waiting for user data...');
    setJustLoggedIn(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0B0B14 0%, #10101A 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "24px 40px" }}>
        <BrandLogo height={46} />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            background: "#181827",
            borderRadius: 20,
            padding: "40px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: "1px solid #2A2A40",
          }}
        >
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F5F3FF", letterSpacing: "-0.5px", marginBottom: 8 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "#AAB2D5" }}>Sign in to continue to FrameFlow</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#AAB2D5", display: "block", marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: "1.5px solid #2A2A40", fontSize: 14,
                  outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
                  opacity: loading ? 0.6 : 1,
                  background: "#11111B",
                  color: "#FFFFFF",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#FF2E9A"; e.target.style.boxShadow = "0 0 16px rgba(255,46,154,0.3)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "#2A2A40"; e.target.style.boxShadow = "none"; }}
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label style={{ fontSize: 13, fontWeight: 600, color: "#AAB2D5" }}>Password</label>
                <a href="#" style={{ fontSize: 12, color: "#FF2E9A", textDecoration: "none" }}>Forgot password?</a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "11px 40px 11px 14px", borderRadius: 10,
                    border: "1.5px solid #2A2A40", fontSize: 14, color: "#FFFFFF",
                    outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
                    opacity: loading ? 0.6 : 1,
                    background: "#11111B",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#FF2E9A"; e.target.style.boxShadow = "0 0 16px rgba(255,46,154,0.3)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "#2A2A40"; e.target.style.boxShadow = "none"; }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#FF2E9A", padding: 0, display: "flex", alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(255,61,113,0.1)", border: "1px solid #FF3D71",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: "#FF3D71", fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: 10,
                background: loading ? "rgba(168,85,247,0.5)" : "linear-gradient(135deg, #7C3AED 0%, #A855F7 25%, #FF2E9A 75%, #FF8A34 100%)",
                color: "white", fontWeight: 700, fontSize: 15,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                marginTop: 8, fontFamily: "'Inter', sans-serif",
                boxShadow: loading ? "none" : "0 8px 30px rgba(168,85,247,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.2s",
              }}
            >
              {loading && <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <span style={{ fontSize: 14, color: "#AAB2D5" }}>Don't have an account? </span>
            <Link to={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : "/signup"} style={{ fontSize: 14, fontWeight: 600, color: "#FF2E9A", textDecoration: "none" }}>
              Sign up free
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#2A2A40" }} />
            <span style={{ fontSize: 12, color: "#7E86A4" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "#2A2A40" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["Google", "GitHub"].map((provider) => (
              <button
                key={provider}
                disabled
                style={{
                  padding: "11px", borderRadius: 10, border: "1.5px solid #2A2A40",
                  background: "#161622", fontSize: 14, fontWeight: 500,
                  color: "#7E86A4", cursor: "not-allowed",
                  fontFamily: "'Inter', sans-serif",
                }}
                title="Coming soon"
              >
                {provider}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}