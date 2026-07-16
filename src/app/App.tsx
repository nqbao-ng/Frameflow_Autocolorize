import { Suspense, lazy, type ReactNode } from "react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { AdminGuard } from "@/features/auth/components/AdminGuard";

const HomePage = lazy(() => import("@/features/home/HomePage").then((module) => ({ default: module.HomePage })));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const UserSettingsPage = lazy(() => import("@/features/auth/UserSettingsPage").then((module) => ({ default: module.UserSettingsPage })));
const ProjectSettingsPage = lazy(() => import("@/features/auth/ProjectSettingsPage").then((module) => ({ default: module.ProjectSettingsPage })));
const Dashboard = lazy(() => import("@/features/dashboard/DashboardPage").then((module) => ({ default: module.Dashboard })));
const SignInPage = lazy(() => import("@/features/auth/SignInPage").then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import("@/features/auth/SignUpPage").then((module) => ({ default: module.SignUpPage })));
const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((module) => ({ default: module.AdminPage })));
const CreativeStudioPage = lazy(() => import("@/features/creative/CreativeStudioPage").then((module) => ({ default: module.CreativeStudioPage })));
const PaymentResultPage = lazy(() => import("@/features/billing/PaymentResultPage").then((module) => ({ default: module.PaymentResultPage })));

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0B0B14", color: "#C4B5FD", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800 }}>FrameFlow</div><div style={{ fontSize: 12, color: "#8F96B3", marginTop: 6 }}>Loading workspace…</div></div>
    </div>
  );
}

function page(content: ReactNode) {
  return <Suspense fallback={<LoadingScreen />}>{content}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, element: page(<HomePage />) },
      { path: "projects", element: <AuthGuard>{page(<ProjectsPage />)}</AuthGuard> },
      { path: "settings", element: <AuthGuard>{page(<UserSettingsPage />)}</AuthGuard> },
      { path: "project-settings", element: <AuthGuard>{page(<ProjectSettingsPage />)}</AuthGuard> },
      { path: "dashboard/:projectId", element: <AuthGuard>{page(<Dashboard />)}</AuthGuard> },
      { path: "creative-studio", element: <AuthGuard>{page(<CreativeStudioPage />)}</AuthGuard> },
      { path: "payment/result", element: <AuthGuard>{page(<PaymentResultPage />)}</AuthGuard> },
      { path: "signin", element: page(<SignInPage />) },
      { path: "signup", element: page(<SignUpPage />) },
      { path: "admin", element: <AdminGuard>{page(<AdminPage />)}</AdminGuard> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
