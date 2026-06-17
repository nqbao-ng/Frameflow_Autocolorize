import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Zap, User, LogOut, Settings, Palette, Bell, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function ProjectsHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const initials = (user as any)?.fullName
    ? (user as any).fullName[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? "U";

  const menuItems = [
    { icon: Settings,    label: "Account settings", to: "/settings?tab=account" },
    { icon: Palette,     label: "Appearance",        to: "/settings?tab=appearance" },
    { icon: Bell,        label: "Notifications",     to: "/settings?tab=notifications" },
    { icon: ShieldCheck, label: "Security",          to: "/settings?tab=security" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      height: 64,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>FrameFlow</span>
        </Link>

        {/* User dropdown */}
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", color: "white", fontSize: 16 }}
          >
            <User size={15} color="white" />
          </button>

          {open && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 10px)",
              width: 260, background: "white",
              border: "1px solid #E2E8F0", borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
              zIndex: 999, overflow: "hidden",
            }}>
              {/* Profile */}
              <div style={{ padding: 16, borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(user as any)?.fullName ?? "Người dùng"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.email}
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: "#3B82F6", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, marginTop: 4 }}>
                    ✦ Free plan
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #F1F5F9" }}>
                {[
                  { label: "Credits", value: "0" },
                  { label: "Projects", value: "—" },
                  { label: "Member since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN", { month: "short", year: "numeric" }) : "—" },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: "#F8FAFC", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Menu items */}
              <div style={{ padding: 6 }}>
                {menuItems.map(({ icon: Icon, label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, color: "#374151", fontSize: 13, textDecoration: "none", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <Icon size={15} color="#64748B" />
                    <span style={{ flex: 1 }}>{label}</span>
                    <ChevronRight size={13} color="#CBD5E1" />
                  </Link>
                ))}

                <div style={{ height: 1, background: "#F1F5F9", margin: "4px 6px" }} />

                <button
                  onClick={handleSignOut}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, color: "#EF4444", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FEF2F2")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={15} color="#EF4444" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}