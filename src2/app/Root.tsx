import { Outlet, useLocation } from "react-router";

export function Root() {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Inter', sans-serif", color: "#1E293B" }}
    >
      <Outlet />
    </div>
  );
}
