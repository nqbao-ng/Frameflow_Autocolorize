import { useEffect, useState, type CSSProperties, type ElementType } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Edit2,
  Gauge,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/hooks/useAuth";
import { BrandLogo } from "@/shared/components/BrandLogo";
import {
  adjustCreditsForUser,
  deleteUser,
  getAllUsers,
  getAuditLogs,
  getOperationalMetrics,
  getPayments,
  updateUserRole,
  type AdminPayment,
  type AdminUser,
  type AuditLog,
  type OperationalMetrics,
  type PagedResult,
} from "./services/admin.api";

type AdminTab = "users" | "payments" | "audit";
type UserRoleFilter = "all" | "user" | "admin";
type UserPlanFilter = "all" | "trial" | "free" | "pro" | "studio";
type PaymentStatusFilter = "all" | "pending" | "paid" | "cancelled" | "expired" | "failed";

const EMPTY_PAGE = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };

const S = {
  card: {
    background: "white",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  } as CSSProperties,
  input: {
    height: 40,
    padding: "0 12px",
    borderRadius: 9,
    border: "1px solid #CBD5E1",
    background: "white",
    color: "#0F172A",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  } as CSSProperties,
  button: {
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 9,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  } as CSSProperties,
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function badgeColors(value: string | null | undefined) {
  switch (String(value || "").toLowerCase()) {
    case "paid":
    case "active":
    case "pro":
      return { color: "#047857", background: "#D1FAE5", border: "#A7F3D0" };
    case "pending":
    case "trial":
      return { color: "#B45309", background: "#FEF3C7", border: "#FDE68A" };
    case "failed":
    case "cancelled":
      return { color: "#B91C1C", background: "#FEE2E2", border: "#FECACA" };
    case "admin":
      return { color: "#6D28D9", background: "#EDE9FE", border: "#DDD6FE" };
    default:
      return { color: "#475569", background: "#F1F5F9", border: "#E2E8F0" };
  }
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  const colors = badgeColors(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {value || "none"}
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{ ...S.card, padding: 14, display: "flex", gap: 9, alignItems: "center", color: "#B91C1C", background: "#FEF2F2", borderColor: "#FECACA", marginBottom: 16 }}>
      <AlertCircle size={17} />
      <span style={{ fontSize: 13 }}>{message}</span>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "52px 20px", color: "#64748B" }}>
      <Loader2 size={25} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
      <div style={{ marginTop: 12, fontSize: 13 }}>{label}</div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontWeight: 800, color: "#334155" }}>{title}</div>
      <div style={{ marginTop: 6, color: "#94A3B8", fontSize: 13 }}>{description}</div>
    </div>
  );
}

function Pagination({ data, onPageChange }: { data: PagedResult<unknown>; onPageChange: (page: number) => void }) {
  if (data.totalPages <= 1) return null;
  const first = (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, color: "#64748B", fontSize: 13 }}>
      <span>Showing {first}–{last} of {data.total}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={data.page <= 1}
          onClick={() => onPageChange(data.page - 1)}
          style={{ ...S.button, background: "white", border: "1px solid #CBD5E1", color: "#475569", opacity: data.page <= 1 ? 0.5 : 1 }}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span style={{ padding: "0 5px" }}>Page {data.page} / {data.totalPages}</span>
        <button
          type="button"
          disabled={data.page >= data.totalPages}
          onClick={() => onPageChange(data.page + 1)}
          style={{ ...S.button, background: "white", border: "1px solid #CBD5E1", color: "#475569", opacity: data.page >= data.totalPages ? 0.5 : 1 }}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: ElementType;
  loading: boolean;
}

function MetricCard({ label, value, detail, color, icon: Icon, loading }: MetricCardProps) {
  return (
    <div style={{ ...S.card, padding: 18, minHeight: 130 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}14`, color, display: "grid", placeItems: "center" }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ fontSize: 26, lineHeight: 1.2, fontWeight: 800, color: "#0F172A", marginTop: 14 }}>{loading ? "—" : value}</div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>{loading ? "Loading..." : detail}</div>
    </div>
  );
}

function DashboardStats({ adminId, refreshTrigger }: { adminId: string; refreshTrigger: number }) {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const result = await getOperationalMetrics(adminId);
      if (cancelled) return;
      if (result.success && result.data) setMetrics(result.data);
      else setError(result.error || "Could not load dashboard metrics");
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [adminId, refreshTrigger]);

  const m = metrics;
  return (
    <>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
        <MetricCard label="Revenue · 30 days" value={formatVnd(m?.revenue30dVnd || 0)} detail={`${m?.paidOrders30d || 0} paid orders · before fees/refunds`} color="#0F9F6E" icon={CircleDollarSign} loading={loading} />
        <MetricCard label="Active subscriptions" value={formatNumber(m?.activeSubscriptions || 0)} detail={`Current paid access · ${formatVnd(m?.revenueAllTimeVnd || 0)} collected all time`} color="#7C3AED" icon={ShieldCheck} loading={loading} />
        <MetricCard label="Active creators" value={formatNumber(m?.activeUsers || 0)} detail="Unique users with product usage in 30 days" color="#2563EB" icon={Activity} loading={loading} />
        <MetricCard label="Total users" value={formatNumber(m?.totalUsers || 0)} detail={`+${m?.newUsers30d || 0} registered in 30 days`} color="#0891B2" icon={Users} loading={loading} />
        <MetricCard label="Pending payments" value={formatNumber(m?.pendingPayments || 0)} detail="Unexpired PayOS orders awaiting payment" color="#D97706" icon={CreditCard} loading={loading} />
        <MetricCard label="Available credits" value={formatNumber(m?.totalCredits || 0)} detail={`${formatNumber(m?.creativeCreditsUsed || 0)} Creative Credits used in 30 days`} color="#DB2777" icon={Gauge} loading={loading} />
        <MetricCard label="Processing usage" value={formatNumber(m?.processingFrames || 0)} detail="Metered frames processed in 30 days" color="#4F46E5" icon={UserRoundCheck} loading={loading} />
        <MetricCard label="Estimated cost · 30 days" value={`$${(m?.estimatedCostUsd || 0).toFixed(2)}`} detail="Telemetry estimate, not an accounting expense" color="#DC2626" icon={Activity} loading={loading} />
      </div>
    </>
  );
}

interface UserRowProps {
  user: AdminUser;
  adminId: string;
  onRefresh: () => void;
}

function UserRow({ user, adminId, onRefresh }: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(user.role || "user");
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const complete = (message: string) => {
    setSuccess(message);
    setTimeout(() => {
      setSuccess("");
      setEditing(false);
      onRefresh();
    }, 900);
  };

  const handleUpdateRole = async () => {
    setSaving(true);
    setError("");
    const result = await updateUserRole(adminId, user.id, newRole);
    setSaving(false);
    if (result.success) complete("Role updated");
    else setError(result.error || "Failed to update role");
  };

  const handleAdjustCredits = async () => {
    const amount = Number(creditsAmount);
    if (!Number.isInteger(amount) || amount === 0 || creditsReason.trim().length < 3) {
      setError("Enter a non-zero whole number and a clear reason");
      return;
    }
    setSaving(true);
    setError("");
    const result = await adjustCreditsForUser(adminId, user.id, amount, creditsReason.trim());
    setSaving(false);
    if (result.success) {
      setCreditsAmount("");
      setCreditsReason("");
      complete(amount > 0 ? "Credits added" : "Credits deducted");
    } else {
      setError(result.error || "Failed to adjust credits");
    }
  };

  const handleDelete = async () => {
    const typedEmail = window.prompt(`Permanently delete ${user.email}?\n\nType the full email address to confirm.`);
    if (typedEmail === null) return;
    if (typedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError("Email confirmation did not match. The account was not deleted.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await deleteUser(adminId, user.id);
    setSaving(false);
    if (result.success) complete("User deleted");
    else setError(result.error || "Failed to delete user");
  };

  return (
    <div style={{ ...S.card, padding: 18, marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{user.full_name || "Unnamed user"}</span>
            <StatusBadge value={user.role} />
            <StatusBadge value={user.subscription_plan} />
            {user.subscription_status && <StatusBadge value={user.subscription_status} />}
          </div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 5, overflowWrap: "anywhere" }}>{user.email}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 18px", marginTop: 12, fontSize: 12, color: "#64748B" }}>
            <span>Credits: <strong style={{ color: "#2563EB" }}>{formatNumber(user.credits)}</strong></span>
            <span>Joined: <strong style={{ color: "#334155" }}>{formatDate(user.created_at)}</strong></span>
            <span>Paid access until: <strong style={{ color: "#334155" }}>{formatDate(user.subscription_period_end)}</strong></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => { setEditing(!editing); setError(""); }} style={{ ...S.button, background: editing ? "#DBEAFE" : "#F1F5F9", color: editing ? "#1D4ED8" : "#475569" }}>
            <Edit2 size={14} /> Manage
          </button>
          <button type="button" onClick={handleDelete} disabled={saving || user.role === "admin"} title={user.role === "admin" ? "Demote this admin before deleting" : "Delete account"} style={{ ...S.button, background: "#FEE2E2", color: "#B91C1C", opacity: saving || user.role === "admin" ? 0.45 : 1 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E2E8F0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 7 }}>Account role</label>
              <select value={newRole} onChange={(event) => setNewRole(event.target.value)} style={{ ...S.input, width: "100%" }}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" onClick={handleUpdateRole} disabled={saving || newRole === user.role} style={{ ...S.button, background: "#2563EB", color: "white", width: "100%", marginTop: 8, opacity: saving || newRole === user.role ? 0.55 : 1 }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={14} />}
                Update role
              </button>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 7 }}>Credit adjustment</label>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
                <input type="number" step="1" value={creditsAmount} onChange={(event) => setCreditsAmount(event.target.value)} placeholder="+50 / -10" style={{ ...S.input, width: "100%" }} />
                <input type="text" maxLength={240} value={creditsReason} onChange={(event) => setCreditsReason(event.target.value)} placeholder="Reason for this adjustment" style={{ ...S.input, width: "100%" }} />
              </div>
              <button type="button" onClick={handleAdjustCredits} disabled={saving} style={{ ...S.button, background: "#0F9F6E", color: "white", width: "100%", marginTop: 8, opacity: saving ? 0.55 : 1 }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={14} />}
                Apply adjustment
              </button>
            </div>
          </div>
          {error && <div style={{ marginTop: 12, color: "#B91C1C", background: "#FEF2F2", borderRadius: 8, padding: "9px 11px", fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}><AlertCircle size={14} /> {error}</div>}
          {success && <div style={{ marginTop: 12, color: "#047857", background: "#ECFDF5", borderRadius: 8, padding: "9px 11px", fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}><CheckCircle size={14} /> {success}</div>}
        </div>
      )}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative", flex: "1 1 300px" }}>
      <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#94A3B8" }} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={{ ...S.input, width: "100%", paddingLeft: 38 }} />
    </div>
  );
}

function UsersTab({ adminId, refreshTrigger, onRefresh }: { adminId: string; refreshTrigger: number; onRefresh: () => void }) {
  const [data, setData] = useState<PagedResult<AdminUser>>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRoleFilter>("all");
  const [plan, setPlan] = useState<UserPlanFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const result = await getAllUsers(adminId, { page, pageSize: 20, search, role, plan });
      if (cancelled) return;
      if (result.success && result.data) setData(result.data);
      else setError(result.error || "Could not load users");
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [adminId, page, search, role, plan, refreshTrigger]);

  return (
    <section>
      <div style={{ ...S.card, padding: 14, display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <SearchField value={searchInput} onChange={setSearchInput} placeholder="Search users by email or name" />
        <select value={role} onChange={(event) => { setRole(event.target.value as UserRoleFilter); setPage(1); }} style={{ ...S.input, minWidth: 135 }}>
          <option value="all">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select value={plan} onChange={(event) => { setPlan(event.target.value as UserPlanFilter); setPage(1); }} style={{ ...S.input, minWidth: 140 }}>
          <option value="all">All plans</option>
          <option value="trial">Trial</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="studio">Studio</option>
        </select>
      </div>
      <ErrorBanner message={error} />
      {loading ? <LoadingState label="Loading users..." /> : data.items.length === 0 ? <EmptyState title="No users found" description="Try a different search or filter." /> : (
        <>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>{data.total} matching user{data.total === 1 ? "" : "s"}</div>
          {data.items.map((item) => <UserRow key={item.id} user={item} adminId={adminId} onRefresh={onRefresh} />)}
          <Pagination data={data} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function PaymentsTab({ adminId, refreshTrigger }: { adminId: string; refreshTrigger: number }) {
  const [data, setData] = useState<PagedResult<AdminPayment>>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const result = await getPayments(adminId, { page, pageSize: 20, search, status });
      if (cancelled) return;
      if (result.success && result.data) setData(result.data);
      else setError(result.error || "Could not load payments");
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [adminId, page, search, status, refreshTrigger]);

  return (
    <section>
      <div style={{ ...S.card, padding: 14, display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <SearchField value={searchInput} onChange={setSearchInput} placeholder="Search by customer email, name, or order code" />
        <select value={status} onChange={(event) => { setStatus(event.target.value as PaymentStatusFilter); setPage(1); }} style={{ ...S.input, minWidth: 165 }}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <ErrorBanner message={error} />
      {loading ? <LoadingState label="Loading payments..." /> : data.items.length === 0 ? <EmptyState title="No payments found" description="Payment orders will appear here as users start checkout." /> : (
        <>
          <div style={{ ...S.card, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {['Order', 'Customer', 'Plan', 'Amount', 'Status', 'Created / paid', 'Subscription'].map((heading) => (
                      <th key={heading} style={{ textAlign: "left", padding: "12px 14px", color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: "1px solid #EEF2F7" }}>
                      <td style={{ padding: 14, verticalAlign: "top" }}>
                        <div style={{ color: "#0F172A", fontSize: 13, fontWeight: 800 }}>#{payment.order_code}</div>
                        <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{payment.provider || "payOS"}</div>
                      </td>
                      <td style={{ padding: 14, verticalAlign: "top", maxWidth: 240 }}>
                        <div style={{ color: "#334155", fontSize: 13, fontWeight: 700 }}>{payment.customer_name || "Unnamed user"}</div>
                        <div style={{ color: "#64748B", fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>{payment.customer_email}</div>
                      </td>
                      <td style={{ padding: 14, verticalAlign: "top" }}><StatusBadge value={payment.plan_code} /></td>
                      <td style={{ padding: 14, verticalAlign: "top", color: "#0F172A", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{formatVnd(payment.amount_vnd)}</td>
                      <td style={{ padding: 14, verticalAlign: "top" }}>
                        <StatusBadge value={payment.status} />
                        {payment.error_message && <div title={payment.error_message} style={{ color: "#B91C1C", fontSize: 11, marginTop: 6, maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{payment.error_message}</div>}
                      </td>
                      <td style={{ padding: 14, verticalAlign: "top", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>
                        <div>{formatDateTime(payment.created_at)}</div>
                        <div style={{ color: payment.paid_at ? "#047857" : "#94A3B8", marginTop: 5 }}>{payment.paid_at ? `Paid ${formatDateTime(payment.paid_at)}` : "Not paid"}</div>
                      </td>
                      <td style={{ padding: 14, verticalAlign: "top", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>
                        <StatusBadge value={payment.subscription_status} />
                        <div style={{ marginTop: 6 }}>Until {formatDate(payment.subscription_period_end)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination data={data} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function AuditTab({ adminId, refreshTrigger }: { adminId: string; refreshTrigger: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      const result = await getAuditLogs(adminId, 100);
      if (cancelled) return;
      if (result.success) setLogs(result.data || []);
      else setError(result.error || "Could not load audit logs");
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [adminId, refreshTrigger]);

  if (loading) return <LoadingState label="Loading audit logs..." />;
  return (
    <section>
      <ErrorBanner message={error} />
      {logs.length === 0 ? <EmptyState title="No audit events yet" description="Admin changes will be recorded here." /> : logs.map((log) => (
        <div key={log.id} style={{ ...S.card, padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ color: "#0F172A", fontSize: 13, fontWeight: 800 }}>{log.action.replaceAll("_", " ")}</div>
            <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 5 }}>{formatDateTime(log.created_at)}</div>
            {log.target_user_id && <div style={{ color: "#64748B", fontSize: 12, marginTop: 5 }}>Target: <code>{log.target_user_id}</code></div>}
          </div>
          <code style={{ alignSelf: "flex-start", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", color: "#475569", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "7px 9px", borderRadius: 7, fontSize: 11 }}>{JSON.stringify(log.details)}</code>
        </div>
      ))}
    </section>
  );
}

export function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!user) navigate("/signin");
    else if (user.role !== "admin") navigate("/projects");
  }, [user, navigate]);

  if (!user || user.role !== "admin") return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const tabs: { id: AdminTab; label: string; icon: ElementType }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "audit", label: "Audit logs", icon: ShieldCheck },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", fontFamily: "'DM Sans', 'Inter', sans-serif", color: "#0F172A" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid #E2E8F0", minHeight: 64, display: "flex", alignItems: "center", padding: "10px clamp(16px, 4vw, 36px)", justifyContent: "space-between", gap: 14 }}>
        <button type="button" onClick={() => navigate("/projects")} style={{ ...S.button, background: "transparent", color: "#64748B", paddingLeft: 0 }}><ArrowLeft size={16} /> Projects</button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <BrandLogo height={31} />
          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#EDE9FE", color: "#6D28D9", border: "1px solid #DDD6FE", fontWeight: 900, fontSize: 10 }}>ADMIN</span>
        </div>
        <button type="button" onClick={handleSignOut} style={{ ...S.button, background: "white", color: "#64748B", border: "1px solid #CBD5E1" }}><LogOut size={14} /> Sign out</button>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "32px clamp(16px, 3vw, 28px) 56px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><ShieldCheck size={22} color="#6D28D9" /><h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-.02em" }}>Admin Console</h1></div>
            <p style={{ margin: "7px 0 0", color: "#64748B", fontSize: 13 }}>Monitor users, payments, subscriptions, usage and administrative changes.</p>
          </div>
          <button type="button" onClick={() => setRefreshTrigger((value) => value + 1)} style={{ ...S.button, background: "white", color: "#475569", border: "1px solid #CBD5E1" }}><RefreshCw size={14} /> Refresh data</button>
        </div>

        <DashboardStats adminId={user.id} refreshTrigger={refreshTrigger} />

        <nav style={{ ...S.card, padding: 6, display: "inline-flex", flexWrap: "wrap", gap: 4, marginBottom: 18 }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} style={{ ...S.button, minWidth: 110, background: activeTab === id ? "#EDE9FE" : "transparent", color: activeTab === id ? "#6D28D9" : "#64748B" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        {activeTab === "users" && <UsersTab adminId={user.id} refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger((value) => value + 1)} />}
        {activeTab === "payments" && <PaymentsTab adminId={user.id} refreshTrigger={refreshTrigger} />}
        {activeTab === "audit" && <AuditTab adminId={user.id} refreshTrigger={refreshTrigger} />}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #8B5CF6 !important; outline-offset: 2px; }`}</style>
    </div>
  );
}
