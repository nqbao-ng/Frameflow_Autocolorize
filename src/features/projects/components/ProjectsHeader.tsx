import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  User,
  LogOut,
  Settings,
  Palette,
  Bell,
  ShieldCheck,
  ChevronRight,
  FolderKanban,
  WandSparkles,
  LayoutDashboard,
} from "lucide-react";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function ProjectsHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
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
    { icon: Settings, label: "Account settings", to: "/settings?tab=account" },
    { icon: Palette, label: "Appearance", to: "/settings?tab=appearance" },
    { icon: Bell, label: "Notifications", to: "/settings?tab=notifications" },
    { icon: ShieldCheck, label: "Security", to: "/settings?tab=security" },
  ];

  const locationState = (location.state || {}) as { returnTo?: string };
  const dashboardTarget = locationState.returnTo || "/projects";
  const navigation = [
    { icon: FolderKanban, label: "Projects", to: "/projects" },
    { icon: WandSparkles, label: "AI Creative Studio", to: "/creative-studio" },
    { icon: LayoutDashboard, label: "Dashboard", to: dashboardTarget },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(11,11,20,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #252538",
        height: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "0 40px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <BrandLogo height={39} />

        <nav style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }} aria-label="Application navigation">
          {navigation.map(({ icon: Icon, label, to }) => {
            const active = label !== "Dashboard" && location.pathname.startsWith(to);
            return (
              <Link
                key={label}
                to={to}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 10px",
                  borderRadius: 9,
                  color: active ? "#F5F3FF" : "#8F96B3",
                  background: active ? "rgba(168,85,247,0.14)" : "transparent",
                  border: active ? "1px solid rgba(168,85,247,0.26)" : "1px solid transparent",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  textDecoration: "none",
                  transition: "all .15s ease",
                }}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((current) => !current)}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED, #FF2E9A)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "white",
              fontSize: 16,
              boxShadow: "0 5px 16px rgba(124,58,237,0.28)",
            }}
          >
            <User size={15} color="white" />
          </button>

          {open && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 10px)",
                width: 270,
                background: "#151522",
                border: "1px solid #303047",
                borderRadius: 14,
                boxShadow: "0 18px 46px rgba(0,0,0,0.38)",
                zIndex: 999,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 16, borderBottom: "1px solid #29293D", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #FF2E9A)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "#F5F3FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(user as any)?.fullName ?? "FrameFlow user"}
                  </div>
                  <div style={{ fontSize: 11, color: "#8F96B3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.email}
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(168,85,247,0.13)", color: "#D8B4FE", fontSize: 10, fontWeight: 650, padding: "2px 8px", borderRadius: 999, marginTop: 5 }}>
                    ✦ {(user as any)?.subscription_plan || "Free"} plan
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #29293D" }}>
                {[
                  { label: "Credits", value: String((user as any)?.credits ?? 0) },
                  { label: "Projects", value: "—" },
                  { label: "Member", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—" },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1, background: "#0F0F19", border: "1px solid #26263A", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 750, color: "#F5F3FF" }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: "#747B96", marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 6 }}>
                {menuItems.map(({ icon: Icon, label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, color: "#C7CADA", fontSize: 12, textDecoration: "none", cursor: "pointer" }}
                    onMouseEnter={(event) => (event.currentTarget.style.background = "#1D1D2C")}
                    onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
                  >
                    <Icon size={15} color="#8F96B3" />
                    <span style={{ flex: 1 }}>{label}</span>
                    <ChevronRight size={13} color="#565D79" />
                  </Link>
                ))}

                <div style={{ height: 1, background: "#29293D", margin: "4px 6px" }} />

                <button
                  onClick={handleSignOut}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, color: "#F87171", fontSize: 12, background: "none", border: "none", cursor: "pointer", width: "100%" }}
                  onMouseEnter={(event) => (event.currentTarget.style.background = "rgba(239,68,68,.08)")}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={15} color="#F87171" />
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
