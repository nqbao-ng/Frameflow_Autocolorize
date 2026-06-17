// import { createRoot } from "react-dom/client";
// import App from "./app/App.tsx";
// import "./styles/index.css";
// import {
//   AuthProvider,
// } from "@/features/auth/providers/AuthProvider";
// createRoot(document.getElementById("root")!).render(<App />);
  
import { createRoot } from "react-dom/client";

import App from "./app/App.tsx";

import "./styles/index.css";

import {
  AuthProvider,
} from "@/features/auth/providers/AuthProvider";

createRoot(
  document.getElementById("root")!,
).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);