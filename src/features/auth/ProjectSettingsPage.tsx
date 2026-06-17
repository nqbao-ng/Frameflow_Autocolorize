import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, LogOut, Save, Loader2, AlertCircle, CheckCircle, Upload,
} from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { updateProfileData } from "./services/auth.api";

// ─── Shared Styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "white",
    border: "1px solid #E8EFFE",
    borderRadius: 12,
    padding: "20px",
    marginBottom: 16,
  } as React.CSSProperties,
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 14,
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
    width: "100%",
  } as React.CSSProperties,
  button: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    display: "block" as const,
    marginBottom: 8,
  } as React.CSSProperties,
};

export function ProjectSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load initial values
  useEffect(() => {
    if (!user) {
      navigate("/signin");
      return;
    }
    
    setFullName(user.fullName || "");
    setAvatarUrl(user.avatar_url || "");
  }, [user, navigate]);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const result = await updateProfileData(user.id, {
      full_name: fullName,
      avatar_url: avatarUrl,
    });

    setSaving(false);

    if (result.success) {
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 2000);
    } else {
      setError(result.error || "Failed to update profile");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const hasChanges =
    fullName !== (user.fullName || "") ||
    avatarUrl !== (user.avatar_url || "");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F8FF",
        fontFamily: "'DM Sans', 'Inter', sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #E8EFFE",
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => navigate("/projects")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748B",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>
          Project Settings
        </div>
        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            cursor: "pointer",
            color: "#64748B",
            fontSize: 13,
            padding: "6px 12px",
          }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px" }}>
        {/* Profile Header */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                background: avatarUrl ? `url(${avatarUrl})` : "#E5E7EB",
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: "2px solid #E8EFFE",
              }}
            />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>
                {fullName || "No name"}
              </div>
              <div style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
                {user.email}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#94A3B8",
                  marginTop: 8,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span>
                  Credits: <strong style={{ color: "#3B82F6" }}>{user.credits}</strong>
                </span>
                <span>
                  Plan: <strong>{user.subscription_plan}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Section */}
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 20 }}>
            Edit Profile
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              style={S.input}
            />
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
              This will be displayed on your profile
            </div>
          </div>

          {/* Avatar URL */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              style={S.input}
            />
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
              Paste a direct link to your avatar image
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#DC2626",
                background: "#FEE2E2",
                padding: "12px",
                borderRadius: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {success && (
            <div
              style={{
                fontSize: 13,
                color: "#059669",
                background: "#ECFDF5",
                padding: "12px",
                borderRadius: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <CheckCircle size={16} /> {success}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              ...S.button,
              background: hasChanges && !saving ? "#3B82F6" : "#E5E7EB",
              color: hasChanges && !saving ? "white" : "#9CA3AF",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Save Changes
              </>
            )}
          </button>
        </div>

        {/* View Only Section */}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 16 }}>
            Account Information (Read-only)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Email
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  color: "#374151",
                  background: "#F9FAFB",
                }}
              >
                {user.email}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                Cannot be changed
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Subscription Plan
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  color: "#374151",
                  background: "#F9FAFB",
                  textTransform: "capitalize",
                }}
              >
                {user.subscription_plan}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                Contact support to upgrade
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Credits
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  color: "#3B82F6",
                  background: "#F0F9FF",
                  fontWeight: 600,
                }}
              >
                {user.credits} credits
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                Earn or purchase
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Account Type
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  color: user.role === "admin" ? "#DC2626" : "#374151",
                  background: user.role === "admin" ? "#FEE2E2" : "#F9FAFB",
                  textTransform: "capitalize",
                  fontWeight: user.role === "admin" ? 600 : 400,
                }}
              >
                {user.role}
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div
          style={{
            ...S.card,
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1E60AA", marginBottom: 8 }}>
            💡 Tips
          </div>
          <ul
            style={{
              fontSize: 13,
              color: "#1E60AA",
              paddingLeft: 20,
              lineHeight: "1.6",
            }}
          >
            <li>Use a square image for best avatar results</li>
            <li>Avatar URL should point directly to an image file</li>
            <li>Changes are saved immediately after clicking Save</li>
          </ul>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}