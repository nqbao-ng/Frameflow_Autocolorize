// src/features/admin/AdminPage.tsx
//
// Admin dashboard for managing users, credits, and roles.
// Only accessible to users with role === 'admin'.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users, CreditCard, LogOut, ArrowLeft, Search, Trash2, Edit2,
  ChevronDown, Loader2, AlertCircle, CheckCircle, Zap,
} from "lucide-react";
import { useAuth } from "../auth/hooks/useAuth";
import {
  getAllUsers,
  getUserDetails,
  addCreditsToUser,
  updateUserRole,
  deleteUser,
  getAuditLogs,
  getTotalUserCount,
  getTotalCreditsDistributed,
  getActiveUsersThisMonth,
  type AdminUser,
  type AuditLog,
} from "./services/admin.api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = "users" | "credits" | "audit";

// ─── Shared Styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "white",
    border: "1px solid #E8EFFE",
    borderRadius: 12,
    padding: "16px",
    marginBottom: 16,
  } as React.CSSProperties,
  input: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 14,
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,
  button: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,
};

// ─── User Management Tab ───────────────────────────────────────────────────────

interface UserRowProps {
  user: AdminUser;
  adminId: string;
  onRefresh: () => void;
}

function UserRow({ user, adminId, onRefresh }: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdateRole = async () => {
    setSaving(true);
    setError("");
    const result = await updateUserRole(adminId, user.id, newRole);
    setSaving(false);
    if (result.success) {
      setSuccess("Role updated!");
      setTimeout(() => {
        setSuccess("");
        setEditing(false);
        onRefresh();
      }, 1500);
    } else {
      setError(result.error || "Failed to update role");
    }
  };

  const handleAddCredits = async () => {
    if (!creditsAmount || !creditsReason) {
      setError("Please fill in all fields");
      return;
    }
    setAddingCredits(true);
    setError("");
    const result = await addCreditsToUser(adminId, user.id, parseInt(creditsAmount), creditsReason);
    setAddingCredits(false);
    if (result.success) {
      setSuccess("Credits added!");
      setCreditsAmount("");
      setCreditsReason("");
      setTimeout(() => {
        setSuccess("");
        onRefresh();
      }, 1500);
    } else {
      setError(result.error || "Failed to add credits");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete user ${user.email}? This action cannot be undone.`)) return;
    setSaving(true);
    setError("");
    const result = await deleteUser(adminId, user.id);
    setSaving(false);
    if (result.success) {
      setSuccess("User deleted!");
      setTimeout(() => {
        setSuccess("");
        onRefresh();
      }, 1500);
    } else {
      setError(result.error || "Failed to delete user");
    }
  };

  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* User Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>
            {user.full_name || "No name"}
          </div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
            {user.email}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, color: "#475569" }}>
            <span>
              Credits: <strong style={{ color: "#3B82F6" }}>{user.credits}</strong>
            </span>
            <span>
              Plan: <strong>{user.subscription_plan}</strong>
            </span>
            <span>
              Role: <strong style={{ color: user.role === "admin" ? "#EF4444" : "#64748B" }}>
                {user.role}
              </strong>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              ...S.button,
              background: editing ? "#EFF6FF" : "#F3F4F6",
              color: editing ? "#3B82F6" : "#6B7280",
            }}
          >
            <Edit2 size={13} style={{ display: "inline-block" }} />
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{
              ...S.button,
              background: "#FEE2E2",
              color: "#DC2626",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Trash2 size={13} style={{ display: "inline-block" }} />
          </button>
        </div>
      </div>

      {/* Edit/Add Credits Panel */}
      {editing && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* Change Role */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{
                  ...S.input,
                  width: "100%",
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleUpdateRole}
                disabled={saving}
                style={{
                  ...S.button,
                  background: "#3B82F6",
                  color: "white",
                  width: "100%",
                  marginTop: 8,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Updating..." : "Update Role"}
              </button>
            </div>

            {/* Add Credits */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Add Credits
              </label>
              <input
                type="number"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                placeholder="Amount"
                style={{ ...S.input, width: "100%", marginBottom: 6 }}
              />
              <input
                type="text"
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
                placeholder="Reason"
                style={{ ...S.input, width: "100%", marginBottom: 8 }}
              />
              <button
                onClick={handleAddCredits}
                disabled={addingCredits}
                style={{
                  ...S.button,
                  background: "#10B981",
                  color: "white",
                  width: "100%",
                  opacity: addingCredits ? 0.6 : 1,
                }}
              >
                {addingCredits ? "Adding..." : "Add Credits"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#DC2626",
                background: "#FEE2E2",
                padding: "8px 12px",
                borderRadius: 6,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div
              style={{
                fontSize: 13,
                color: "#059669",
                background: "#ECFDF5",
                padding: "8px 12px",
                borderRadius: 6,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <CheckCircle size={14} /> {success}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type UserFilter = "all" | "admins";

function UsersTab({ adminId, onRefresh, refreshTrigger }: { adminId: string; onRefresh: () => void; refreshTrigger: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const result = await getAllUsers(adminId);
      if (result.success) {
        setUsers(result.data || []);
      }
      setLoading(false);
    };
    loadUsers();
  }, [adminId, refreshTrigger]);

   const filtered = users.filter((u) => {
     const matchesSearch =
       u.email.toLowerCase().includes(search.toLowerCase()) ||
       (u.full_name || "").toLowerCase().includes(search.toLowerCase());
     const matchesFilter = filter === "all" || (filter === "admins" && u.role === "admin");
     return matchesSearch && matchesFilter;
   });

   return (
     <div>
       {/* Filter tabs */}
       <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
         <button
           onClick={() => setFilter("all")}
           style={{
             ...S.button,
             background: filter === "all" ? "#EFF6FF" : "#F3F4F6",
             color: filter === "all" ? "#3B82F6" : "#64748B",
             padding: "8px 16px",
           }}
         >
           All Users ({users.length})
         </button>
         <button
           onClick={() => setFilter("admins")}
           style={{
             ...S.button,
             background: filter === "admins" ? "#FEE2E2" : "#F3F4F6",
             color: filter === "admins" ? "#DC2626" : "#64748B",
             padding: "8px 16px",
           }}
         >
           Admins Only ({users.filter((u) => u.role === "admin").length})
         </button>
       </div>

       <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...S.input,
            width: "100%",
            paddingLeft: 36,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "8px center",
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
          <div style={{ marginTop: 12 }}>Loading users...</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </div>
          {filtered.map((user) => (
            <UserRow key={user.id} user={user} adminId={adminId} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Audit Logs Tab ────────────────────────────────────────────────────────────

function AuditTab({ adminId }: { adminId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const result = await getAuditLogs(adminId, 100);
      if (result.success) {
        setLogs(result.data || []);
      }
      setLoading(false);
    };
    loadLogs();
  }, [adminId]);

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
          <div style={{ marginTop: 12 }}>Loading audit logs...</div>
        </div>
      ) : (
        <div>
          {logs.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", color: "#94A3B8" }}>
              No audit logs yet.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>
                      {log.action}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    {log.target_user_id && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        Target: <code style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>
                          {log.target_user_id.slice(0, 8)}...
                        </code>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      background: "#F3F4F6",
                      color: "#475569",
                      padding: "4px 8px",
                      borderRadius: 4,
                      maxWidth: 200,
                      overflow: "auto",
                    }}
                  >
                    <code>{JSON.stringify(log.details).slice(0, 100)}</code>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check admin access
  useEffect(() => {
    if (!user) {
      navigate("/signin");
    } else if (user.role !== 'admin') {
      console.warn('[AdminPage] Non-admin user attempted access:', user.email);
      navigate("/projects");
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "credits", label: "Credits", icon: CreditCard },
    { id: "audit", label: "Audit Logs", icon: AlertCircle },
  ];

  // Dashboard stats component
  const DashboardStats = () => {
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [totalCredits, setTotalCredits] = useState<number | null>(null);
    const [activeUsers, setActiveUsers] = useState<number | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
      const loadStats = async () => {
        setStatsLoading(true);
        const [usersResult, creditsResult, activeResult] = await Promise.all([
          getTotalUserCount(user.id),
          getTotalCreditsDistributed(user.id),
          getActiveUsersThisMonth(user.id),
        ]);

        if (usersResult.success) setTotalUsers(usersResult.data ?? 0);
        if (creditsResult.success) setTotalCredits(creditsResult.data ?? 0);
        if (activeResult.success) setActiveUsers(activeResult.data ?? 0);
        setStatsLoading(false);
      };
      loadStats();
    }, [user.id, refreshTrigger]);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
            Total Users
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1E293B" }}>
            {statsLoading ? "—" : totalUsers}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            {statsLoading ? "Loading..." : ""}
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
            Total Credits Distributed
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10B981" }}>
            {statsLoading ? "—" : totalCredits}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Across all users</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
            Active This Month
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3B82F6" }}>
            {statsLoading ? "—" : activeUsers}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Last 30 days</div>
        </div>
      </div>
    );
  };

  // Credits management component
  const CreditsTab = () => {
    return (
      <div>
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", marginBottom: 12 }}>
            Credits System
          </div>
          <div style={{ fontSize: 13, color: "#64748B", lineHeight: "1.6" }}>
            Manage user credits directly from the <strong>Users</strong> tab. Click the edit button on any user card to:
          </div>
          <ul style={{ fontSize: 13, color: "#64748B", marginTop: 12, paddingLeft: 20, lineHeight: "1.7" }}>
            <li>Add credits with a reason/memo</li>
            <li>Track credit history via audit logs</li>
            <li>Adjust subscription plans per user</li>
          </ul>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 16, padding: "12px", background: "#F0F9FF", borderRadius: 8, borderLeft: "3px solid #3B82F6" }}>
            💡 Use the "Reason" field to document why credits were added (e.g., "Promotional bonus", "Bug compensation")
          </div>
        </div>
      </div>
    );
  };

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
          <ArrowLeft size={16} /> Back to projects
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={14} color="white" fill="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#1E293B" }}>Admin</span>
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, borderBottom: "1px solid #E8EFFE", paddingBottom: 16 }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: activeTab === id ? "#EFF6FF" : "transparent",
                color: activeTab === id ? "#3B82F6" : "#64748B",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: activeTab === id ? 600 : 500,
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <DashboardStats />
        
        {activeTab === "users" && (
          <UsersTab
            adminId={user.id}
            onRefresh={() => setRefreshTrigger((t) => t + 1)}
            refreshTrigger={refreshTrigger}
          />
        )}
        {activeTab === "credits" && <CreditsTab />}
        {activeTab === "audit" && <AuditTab adminId={user.id} />}
      </div>
    </div>
  );
}
