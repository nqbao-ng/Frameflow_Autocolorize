import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  User, Palette, Bell, ShieldCheck, CreditCard,
  Camera, Save, LogOut, Check, ChevronRight,
  Sun, Moon, Monitor, Eye, EyeOff, Zap, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/auth/hooks/useProfile";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "account" | "appearance" | "notifications" | "security" | "billing";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "account",       label: "Account",       icon: User },
  { id: "appearance",    label: "Appearance",     icon: Palette },
  { id: "notifications", label: "Notifications",  icon: Bell },
  { id: "security",      label: "Security",       icon: ShieldCheck },
  { id: "billing",       label: "Billing",        icon: CreditCard },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

const S = {
  card: {
    background: "white",
    border: "1px solid #E8EFFE",
    borderRadius: 16,
    padding: "24px 28px",
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1.5px solid #E2E8F0",
    fontSize: 14,
    color: "#1E293B",
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: 4,
  } as React.CSSProperties,
  sectionDesc: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 20,
  } as React.CSSProperties,
};

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 22px", borderRadius: 10,
        background: saved ? "#10B981" : "#3B82F6",
        color: "white", border: "none", cursor: "pointer",
        fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
        transition: "background 0.2s",
      }}
    >
      {saved ? <Check size={15} /> : <Save size={15} />}
      {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: checked ? "#3B82F6" : "#E2E8F0",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "white",
        transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

function NotifRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{label}</div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Tab: Account ─────────────────────────────────────────────────────────────

function AccountTab({ user }: { user: any }) {
  const { profile, loading, updateProfile } = useProfile(user?.id ?? null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const initials = fullName ? fullName[0].toUpperCase() : user?.email?.[0]?.toUpperCase() ?? "U";

  const handleSave = async () => {
    setSaving(true);
    const success = await updateProfile({
      full_name: fullName,
      avatar_url: avatarUrl,
    });
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  return (
    <>
      {/* Avatar card */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Profile picture</div>
        <div style={{ ...S.sectionDesc }}>This is shown in the header and on your projects.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: avatarUrl ? undefined : "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, color: "white", fontWeight: 700,
              border: "3px solid #EFF6FF",
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </div>
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: "50%",
              background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid white", cursor: "pointer",
            }}>
              <Camera size={12} color="white" />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              style={S.input}
              onFocus={e => (e.target.style.borderColor = "#3B82F6")}
              onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
            />
          </div>
        </div>
      </div>

      {/* Info card */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Personal information</div>
        <div style={S.sectionDesc}>Update your display name and bio.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={S.label}>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={S.input}
              onFocus={e => (e.target.style.borderColor = "#3B82F6")}
              onBlur={e => (e.target.style.borderColor = "#E2E8F0")} />
          </div>
          <div>
            <label style={S.label}>Email</label>
            <input value={user.email ?? ""} disabled style={{ ...S.input, background: "#F8FAFC", color: "#94A3B8", cursor: "not-allowed" }} />
          </div>
        </div>

         <div style={{ marginBottom: 20 }}>
           <label style={S.label}>Email</label>
           <input value={user.email ?? ""} disabled style={{ ...S.input, background: "#F8FAFC", color: "#94A3B8", cursor: "not-allowed" }} />
         </div>

        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>

      {/* Joined info */}
      <div style={{ ...S.card, background: "#F8FAFF", border: "1px solid #DBEAFE" }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Member since", value: user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—" },
            { label: "Email verified", value: user.emailConfirmed ? "✓ Verified" : "✗ Not verified" },
            { label: "User ID", value: user.id?.slice(0, 8) + "…" },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tab: Appearance ──────────────────────────────────────────────────────────

function AppearanceTab() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [accent, setAccent] = useState("#3B82F6");
  const [fontSize, setFontSize] = useState("medium");
  const [saved, setSaved] = useState(false);

  const accents = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"];
  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark",  label: "Dark",  icon: Moon },
    { id: "system",label: "System",icon: Monitor },
  ] as const;

  const handleSave = () => {
    localStorage.setItem("app_appearance", JSON.stringify({ theme, accent, fontSize }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.sectionTitle}>Theme</div>
        <div style={S.sectionDesc}>Choose how FrameFlow looks for you.</div>
        <div style={{ display: "flex", gap: 12 }}>
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              style={{
                flex: 1, padding: "16px 12px", borderRadius: 12, cursor: "pointer",
                border: theme === id ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
                background: theme === id ? "#EFF6FF" : "white",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              <Icon size={20} color={theme === id ? "#3B82F6" : "#94A3B8"} />
              <span style={{ fontSize: 13, fontWeight: 600, color: theme === id ? "#3B82F6" : "#64748B" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Accent color</div>
        <div style={S.sectionDesc}>This color is used for buttons, links, and highlights.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {accents.map(c => (
            <button
              key={c}
              onClick={() => setAccent(c)}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: c, border: accent === c ? `3px solid ${c}` : "3px solid transparent",
                outline: accent === c ? `2px solid ${c}` : "none",
                outlineOffset: 2,
                cursor: "pointer", transition: "all 0.15s",
              }}
            />
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Font size</div>
        <div style={S.sectionDesc}>Adjust the text size across the app.</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["small", "medium", "large"].map(s => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              style={{
                padding: "8px 20px", borderRadius: 8, cursor: "pointer",
                border: fontSize === s ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
                background: fontSize === s ? "#EFF6FF" : "white",
                color: fontSize === s ? "#3B82F6" : "#64748B",
                fontWeight: 600, fontSize: 13, transition: "all 0.15s",
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          <SaveButton saving={false} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </>
  );
}

// ─── Tab: Notifications ───────────────────────────────────────────────────────

function NotificationsTab() {
  const [notifs, setNotifs] = useState({
    projectUpdates: true,
    comments: true,
    exports: true,
    teamInvites: true,
    marketing: false,
    weeklyDigest: false,
  });
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof notifs) => (v: boolean) =>
    setNotifs(prev => ({ ...prev, [key]: v }));

  const handleSave = () => {
    localStorage.setItem("app_notifications", JSON.stringify(notifs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.sectionTitle}>In-app notifications</div>
        <div style={S.sectionDesc}>Control what you see inside the app.</div>
        <NotifRow label="Project updates" desc="When a project you own is edited" checked={notifs.projectUpdates} onChange={set("projectUpdates")} />
        <NotifRow label="Comments" desc="When someone comments on your work" checked={notifs.comments} onChange={set("comments")} />
        <NotifRow label="Export complete" desc="When your export finishes" checked={notifs.exports} onChange={set("exports")} />
        <NotifRow label="Team invites" desc="When you're added to a team" checked={notifs.teamInvites} onChange={set("teamInvites")} />
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Email notifications</div>
        <div style={S.sectionDesc}>Sent to your registered email address.</div>
        <NotifRow label="Marketing & tips" desc="Product news and best practices" checked={notifs.marketing} onChange={set("marketing")} />
        <NotifRow label="Weekly digest" desc="A summary of your activity each week" checked={notifs.weeklyDigest} onChange={set("weeklyDigest")} />
        <div style={{ marginTop: 20 }}>
          <SaveButton saving={false} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </>
  );
}

// ─── Tab: Security ────────────────────────────────────────────────────────────

function SecurityTab({ user }: { user: any }) {
   const [currentPw, setCurrentPw] = useState("");
   const [newPw, setNewPw] = useState("");
   const [confirmPw, setConfirmPw] = useState("");
   const [showPw, setShowPw] = useState(false);
   const [saving, setSaving] = useState(false);
   const [saved, setSaved] = useState(false);
   const [error, setError] = useState("");

   const handleSave = async () => {
     setError("");
     if (newPw !== confirmPw) { setError("Passwords do not match"); return; }
     if (newPw.length < 8) { setError("Password must be at least 8 characters"); return; }
     setSaving(true);
     
     try {
       const { error: updateError } = await user.updateUser?.({ password: newPw });
       if (updateError) {
         setError(updateError.message ?? "Failed to update password");
       } else {
         setSaved(true);
         setCurrentPw(""); setNewPw(""); setConfirmPw("");
         setTimeout(() => setSaved(false), 2000);
       }
     } catch (err) {
       setError(err instanceof Error ? err.message : "Failed to update password");
     }
     setSaving(false);
   };

  const pwInput = (label: string, value: string, onChange: (v: string) => void) => (
    <div style={{ marginBottom: 16 }}>
      <label style={S.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={showPw ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...S.input, paddingRight: 40 }}
          onFocus={e => (e.target.style.borderColor = "#3B82F6")}
          onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
        />
        <button
          type="button"
          onClick={() => setShowPw(s => !s)}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
        >
          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div style={S.card}>
        <div style={S.sectionTitle}>Change password</div>
        <div style={S.sectionDesc}>Use a strong password with letters, numbers, and symbols.</div>
        {pwInput("Current password", currentPw, setCurrentPw)}
        {pwInput("New password", newPw, setNewPw)}
        {pwInput("Confirm new password", confirmPw, setConfirmPw)}
        {error && <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>⚠ {error}</div>}
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Active sessions</div>
        <div style={S.sectionDesc}>Devices currently logged in to your account.</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>This device</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Last active: just now · {navigator.userAgent.includes("Win") ? "Windows" : "macOS"}</div>
          </div>
          <span style={{ fontSize: 12, background: "#ECFDF5", color: "#059669", padding: "4px 10px", borderRadius: 999, fontWeight: 600 }}>Current</span>
        </div>
      </div>

      <div style={{ ...S.card, border: "1px solid #FECACA", background: "#FFF8F8" }}>
        <div style={{ ...S.sectionTitle, color: "#DC2626" }}>Danger zone</div>
        <div style={{ ...S.sectionDesc }}>These actions are permanent and cannot be undone.</div>
        <button style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #FECACA", background: "white", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Delete my account
        </button>
      </div>
    </>
  );
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

function BillingTab({ user }: { user: any }) {
   const { profile, loading } = useProfile(user?.id ?? null);
   const credits = profile?.credits ?? 0;
   const subscription_plan = profile?.subscription_plan ?? "free";

   const plans = [
     { name: "free", label: "Free", price: "$0", period: "forever", features: ["5 projects", "50 exports/mo", "Basic templates"] },
     { name: "pro",  label: "Pro",  price: "$12", period: "/ month", features: ["Unlimited projects", "500 exports/mo", "All templates", "Priority support"] },
     { name: "enterprise", label: "Enterprise", price: "$29", period: "/ month", features: ["Everything in Pro", "5 team members", "Shared workspace", "Admin dashboard"] },
   ];

  return (
    <>
      {/* Credits card */}
      <div style={{ ...S.card, background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)", border: "1px solid #DBEAFE" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>Available credits</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#1E293B", lineHeight: 1 }}>{credits}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Credits reset every month on your billing date.</div>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={28} color="white" fill="white" />
          </div>
        </div>
        <button style={{ marginTop: 20, padding: "10px 20px", borderRadius: 10, background: "#3B82F6", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Buy more credits
        </button>
      </div>

      {/* Plans */}
      <div style={{ ...S.card }}>
        <div style={S.sectionTitle}>Plans</div>
        <div style={S.sectionDesc}>Choose the plan that works best for you.</div>
         <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
           {plans.map(p => {
             const isCurrent = p.name === subscription_plan;
             return (
             <div key={p.name} style={{
               border: isCurrent ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
               borderRadius: 14, padding: "20px 18px",
               background: isCurrent ? "#F0F7FF" : "white",
               position: "relative",
             }}>
               {isCurrent && (
                 <span style={{ position: "absolute", top: -1, right: 14, fontSize: 11, background: "#3B82F6", color: "white", padding: "3px 10px", borderRadius: "0 0 8px 8px", fontWeight: 600 }}>Current</span>
               )}
               <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{p.label}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#1E293B" }}>{p.price}</span>
                <span style={{ fontSize: 13, color: "#64748B" }}> {p.period}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 16 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: 13, color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={13} color="#10B981" strokeWidth={3} /> {f}
                  </li>
                ))}
              </ul>
               {!isCurrent && (
                 <button style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "1.5px solid #3B82F6", background: "white", color: "#3B82F6", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                   Upgrade
                 </button>
               )}
             </div>
           );
           })}
        </div>
      </div>

      {/* Billing history */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Billing history</div>
        <div style={S.sectionDesc}>No invoices yet.</div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function UserSettingsPage() {
  const { user, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get("tab") as Tab) ?? "account";

  const setTab = (tab: Tab) => setSearchParams({ tab });

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  if (!user) return null;

  const initials = (user as any)?.fullName
    ? (user as any).fullName[0].toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      background: "#F4F8FF",
      backgroundImage: `
        radial-gradient(circle at 15% 10%, rgba(59,130,246,0.07) 0%, transparent 45%),
        radial-gradient(circle at 85% 90%, rgba(139,92,246,0.06) 0%, transparent 40%)
      `,
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E8EFFE", height: 60,
        display: "flex", alignItems: "center", padding: "0 32px", justifyContent: "space-between",
      }}>
        <button
          onClick={() => navigate("/projects")}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Back to projects
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={14} color="white" fill="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#1E293B" }}>FrameFlow</span>
          <span style={{ color: "#CBD5E1", margin: "0 4px" }}>/</span>
          <span style={{ fontSize: 14, color: "#64748B" }}>Settings</span>
        </div>
        <button
          onClick={handleSignOut}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", color: "#64748B", fontSize: 13, padding: "6px 12px" }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px", display: "flex", gap: 28 }}>
        {/* Sidebar */}
        <aside style={{ width: 220, flexShrink: 0 }}>
          {/* Mini profile */}
          <div style={{ background: "white", border: "1px solid #E8EFFE", borderRadius: 16, padding: "20px 16px", marginBottom: 12, textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 22, fontWeight: 700,
              margin: "0 auto 10px",
            }}>
              {initials}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{(user as any)?.fullName ?? "User"}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, background: "#EFF6FF", color: "#3B82F6", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>
              ✦ Free plan
            </span>
          </div>

          {/* Nav */}
          <nav style={{ background: "white", border: "1px solid #E8EFFE", borderRadius: 16, overflow: "hidden" }}>
            {TABS.map(({ id, label, icon: Icon }, i) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "12px 16px",
                  background: activeTab === id ? "#EFF6FF" : "transparent",
                  border: "none",
                  borderLeft: activeTab === id ? "3px solid #3B82F6" : "3px solid transparent",
                  borderBottom: i < TABS.length - 1 ? "1px solid #F1F5F9" : "none",
                  cursor: "pointer", textAlign: "left",
                  color: activeTab === id ? "#3B82F6" : "#475569",
                  fontSize: 13, fontWeight: activeTab === id ? 700 : 500,
                  transition: "all 0.12s",
                }}
              >
                <Icon size={15} />
                {label}
                {activeTab === id && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", marginBottom: 6 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}>
            {activeTab === "account"       && "Manage your profile and personal information."}
            {activeTab === "appearance"    && "Customize how FrameFlow looks and feels."}
            {activeTab === "notifications" && "Control which alerts and updates you receive."}
            {activeTab === "security"      && "Keep your account safe and manage access."}
            {activeTab === "billing"       && "Manage your plan, credits, and invoices."}
          </p>

       {activeTab === "account"       && <AccountTab user={user} />}
           {activeTab === "appearance"    && <AppearanceTab />}
           {activeTab === "notifications" && <NotificationsTab />}
           {activeTab === "security"      && <SecurityTab user={user} />}
           {activeTab === "billing"       && <BillingTab user={user} />}
        </main>
      </div>
    </div>
  );
}