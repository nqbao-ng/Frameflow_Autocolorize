import {
  RouterProvider,
  createBrowserRouter,
} from "react-router";

import { HomePage } from "@/features/home/HomePage";

import {
  ProjectsPage,
} from "@/features/projects/ProjectsPage";

import {
  UserSettingsPage,
} from "@/features/auth/UserSettingsPage";

import {
  ProjectSettingsPage,
} from "@/features/auth/ProjectSettingsPage";

import {
  Dashboard,
} from "@/features/dashboard/DashboardPage";

import {
  SignInPage,
} from "@/features/auth/SignInPage";

import {
  SignUpPage,
} from "@/features/auth/SignUpPage";

import {
  AdminPage,
} from "@/features/admin/AdminPage";

import {
  AuthGuard,
} from "@/features/auth/components/AuthGuard";

import {
  AdminGuard,
} from "@/features/auth/components/AdminGuard";

const router = createBrowserRouter([
  {
    path: "/",

    children: [
      {
        index: true,
        Component: HomePage,
      },

      {
        path: "projects",

        element: (
          <AuthGuard>
            <ProjectsPage />
          </AuthGuard>
        ),
      },
       {
         path: "settings",
         element: (
           <AuthGuard>
             <UserSettingsPage />
           </AuthGuard>
         ),
       },
       {
         path: "project-settings",
         element: (
           <AuthGuard>
             <ProjectSettingsPage />
           </AuthGuard>
         ),
       },

      {
        path: "dashboard/:projectId",

        element: (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        ),
      },

      {
        path: "signin",
        Component: SignInPage,
      },

      {
        path: "signup",
        Component: SignUpPage,
      },

       {
         path: "admin",
         element: (
           <AdminGuard>
             <AdminPage />
           </AdminGuard>
         ),
       },
    ],
  },
]);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}