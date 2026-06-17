// import { useState } from "react";
// import { Link, useNavigate } from "react-router";
// import { Eye, EyeOff, Zap } from "lucide-react";

// const ADMIN_EMAIL    = "admin";
// const ADMIN_PASSWORD = "admin";

// export function SignInPage() {
//   const [showPass, setShowPass]   = useState(false);
//   const [email, setEmail]         = useState("");
//   const [password, setPassword]   = useState("");
//   const [error, setError]         = useState("");
//   const navigate = useNavigate();

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");

//     // Admin shortcut
//     if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
//       navigate("/admin");
//       return;
//     }

//     // Normal user — navigate to projects
//     // TODO: thay bằng real auth khi có backend
//     if (email && password) {
//       navigate("/projects");
//     } else {
//       setError("Invalid email or password.");
//     }
//   };

//   return (
//     <div
//       style={{
//         minHeight: "100vh",
//         background: "linear-gradient(135deg, #F4F8FF 0%, #F0F4FF 100%)",
//         display: "flex",
//         flexDirection: "column",
//         fontFamily: "'Inter', sans-serif",
//       }}
//     >
//       {/* Logo */}
//       <div style={{ padding: "28px 40px" }}>
//         <Link to="/" className="flex items-center gap-2 no-underline" style={{ width: "fit-content" }}>
//           <div style={{ width: 34, height: 34, borderRadius: 10, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <Zap size={18} color="white" fill="white" />
//           </div>
//           <span style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>FrameFlow</span>
//         </Link>
//       </div>

//       {/* Card */}
//       <div className="flex-1 flex items-center justify-center px-4">
//         <div
//           style={{
//             width: "100%",
//             maxWidth: 400,
//             background: "white",
//             borderRadius: 20,
//             padding: "40px",
//             boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
//             border: "1px solid rgba(0,0,0,0.04)",
//           }}
//         >
//           <div style={{ marginBottom: 32, textAlign: "center" }}>
//             <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.5px", marginBottom: 8 }}>
//               Welcome back
//             </h1>
//             <p style={{ fontSize: 14, color: "#64748B" }}>Sign in to continue to FrameFlow</p>
//           </div>

//           <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
//             {/* Email */}
//             <div>
//               <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
//                 Email address
//               </label>
//               <input
//                 type="text"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder="you@example.com"
//                 style={{
//                   width: "100%", padding: "11px 14px", borderRadius: 10,
//                   border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
//                   outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
//                 }}
//                 onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
//                 onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
//                 required
//               />
//             </div>

//             {/* Password */}
//             <div>
//               <div className="flex justify-between items-center mb-1.5">
//                 <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
//                 <a href="#" style={{ fontSize: 12, color: "#3B82F6", textDecoration: "none" }}>Forgot password?</a>
//               </div>
//               <div style={{ position: "relative" }}>
//                 <input
//                   type={showPass ? "text" : "password"}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   placeholder="••••••••"
//                   style={{
//                     width: "100%", padding: "11px 40px 11px 14px", borderRadius: 10,
//                     border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
//                     outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
//                   }}
//                   onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
//                   onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
//                   required
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPass(!showPass)}
//                   style={{
//                     position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
//                     background: "none", border: "none", cursor: "pointer",
//                     color: "#94A3B8", padding: 0, display: "flex", alignItems: "center",
//                   }}
//                 >
//                   {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
//                 </button>
//               </div>
//             </div>

//             {/* Error message */}
//             {error && (
//               <div style={{
//                 background: "#FEF2F2", border: "1px solid #FECACA",
//                 borderRadius: 8, padding: "10px 14px",
//                 fontSize: 13, color: "#DC2626", fontWeight: 500,
//               }}>
//                 {error}
//               </div>
//             )}

//             <button
//               type="submit"
//               style={{
//                 width: "100%", padding: "13px", borderRadius: 10,
//                 background: "#3B82F6", color: "white", fontWeight: 700, fontSize: 15,
//                 border: "none", cursor: "pointer", marginTop: 8,
//                 boxShadow: "0 4px 16px rgba(59,130,246,0.3)", fontFamily: "'Inter', sans-serif",
//               }}
//             >
//               Sign In
//             </button>
//           </form>

//           <div style={{ textAlign: "center", marginTop: 24 }}>
//             <span style={{ fontSize: 14, color: "#64748B" }}>Don't have an account? </span>
//             <Link to="/signup" style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", textDecoration: "none" }}>
//               Sign up free
//             </Link>
//           </div>

//           <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
//             <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
//             <span style={{ fontSize: 12, color: "#94A3B8" }}>or continue with</span>
//             <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             {["Google", "GitHub"].map((provider) => (
//               <button
//                 key={provider}
//                 style={{
//                   padding: "11px", borderRadius: 10, border: "1.5px solid #E2E8F0",
//                   background: "white", fontSize: 14, fontWeight: 500,
//                   color: "#374151", cursor: "pointer", fontFamily: "'Inter', sans-serif",
//                 }}
//               >
//                 {provider}
//               </button>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
// src/features/auth/SignInPage.tsx  (updated)
//
// Đã xoá mock admin login.
// Gọi useAuth() → signIn() → Supabase thật.

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Zap, Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";

export function SignInPage() {
  const [showPass, setShowPass] = useState(false);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const { signIn, user } = useAuth();
  const navigate   = useNavigate();

  // Redirect user after successful login when user data is available
  useEffect(() => {
    if (justLoggedIn && user) {
      console.log('[SignInPage] User loaded:', user.email, 'Role:', user.role);
      
      if (user.role === 'admin') {
        console.log('[SignInPage] Redirecting admin to /admin');
        navigate("/admin");
      } else {
        console.log('[SignInPage] Redirecting user to /projects');
        navigate("/projects");
      }
      setJustLoggedIn(false);
    }
  }, [justLoggedIn, user, navigate]);

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
      <div className="flex-1 flex items-center justify-center px-4">
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
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "#64748B" }}>Sign in to continue to FrameFlow</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                disabled={loading}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
                  outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
                <a href="#" style={{ fontSize: 12, color: "#3B82F6", textDecoration: "none" }}>Forgot password?</a>
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
                    border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
                    outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
                    opacity: loading ? 0.6 : 1,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                  onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#94A3B8", padding: 0, display: "flex", alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: "#DC2626", fontWeight: 500,
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
                background: loading ? "#93C5FD" : "#3B82F6",
                color: "white", fontWeight: 700, fontSize: 15,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                marginTop: 8, fontFamily: "'Inter', sans-serif",
                boxShadow: loading ? "none" : "0 4px 16px rgba(59,130,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.2s",
              }}
            >
              {loading && <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <span style={{ fontSize: 14, color: "#64748B" }}>Don't have an account? </span>
            <Link to="/signup" style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", textDecoration: "none" }}>
              Sign up free
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            <span style={{ fontSize: 12, color: "#94A3B8" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["Google", "GitHub"].map((provider) => (
              <button
                key={provider}
                disabled
                style={{
                  padding: "11px", borderRadius: 10, border: "1.5px solid #E2E8F0",
                  background: "white", fontSize: 14, fontWeight: 500,
                  color: "#94A3B8", cursor: "not-allowed",
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