// /**
//  * projects.api.ts
//  *
//  * Tất cả network calls liên quan đến Projects.
//  *
//  * HIỆN TẠI: mỗi function mock lại local state (simulate delay).
//  * KHI CÓ BACKEND: chỉ cần thay phần bên trong mỗi function —
//  *   interface, return type, và cách hook gọi KHÔNG thay đổi.
//  *
//  * Base URL được đọc từ env var:
//  *   VITE_API_BASE_URL=https://api.yourapp.com
//  */

// import type {
//   Project,
//   CreateProjectPayload,
//   UpdateProjectPayload,
//   ProjectsApiResponse,
// } from "../types";
// import { INITIAL_PROJECTS, IMG_1 } from "../constants/projectsData";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// // ── Generic fetch helper ──────────────────────────────────────────────────────
// async function apiFetch<T>(
//   path: string,
//   options?: RequestInit
// ): Promise<T> {
//   const res = await fetch(`${BASE_URL}${path}`, {
//     headers: { "Content-Type": "application/json" },
//     ...options,
//   });
//   if (!res.ok) {
//     const error = await res.text();
//     throw new Error(error || `HTTP ${res.status}`);
//   }
//   return res.json() as Promise<T>;
// }

// // ── Mock helpers (xóa khi connect backend thật) ───────────────────────────────
// let _mockProjects: Project[] = [...INITIAL_PROJECTS];

// function delay(ms = 300) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// // ── API functions ─────────────────────────────────────────────────────────────

// /**
//  * GET /projects
//  * Fetch danh sách tất cả projects của user hiện tại.
//  *
//  * TODO (backend): return apiFetch<ProjectsApiResponse>("/projects");
//  */
// export async function fetchProjects(): Promise<ProjectsApiResponse> {
//   await delay();
//   return { data: _mockProjects, total: _mockProjects.length };
// }

// /**
//  * POST /projects
//  * Tạo project mới, trả về project đã được tạo (có id từ server).
//  *
//  * TODO (backend):
//  *   return apiFetch<Project>("/projects", {
//  *     method: "POST",
//  *     body: JSON.stringify(payload),
//  *   });
//  */
// export async function createProject(payload: CreateProjectPayload): Promise<Project> {
//   await delay();
//   const newProject: Project = {
//     id: Date.now(),
//     name: payload.name,
//     frames: 0,
//     coloredFrames: 0,
//     status: "draft",
//     lastEdited: "Just now",
//     thumbnail: IMG_1,
//   };
//   _mockProjects = [newProject, ..._mockProjects];
//   return newProject;
// }

// /**
//  * PATCH /projects/:id
//  * Cập nhật một phần project (rename, đổi status…).
//  *
//  * TODO (backend):
//  *   return apiFetch<Project>(`/projects/${id}`, {
//  *     method: "PATCH",
//  *     body: JSON.stringify(payload),
//  *   });
//  */
// export async function updateProject(
//   id: number,
//   payload: UpdateProjectPayload
// ): Promise<Project> {
//   await delay();
//   _mockProjects = _mockProjects.map((p) =>
//     p.id === id ? { ...p, ...payload } : p
//   );
//   const updated = _mockProjects.find((p) => p.id === id);
//   if (!updated) throw new Error(`Project ${id} not found`);
//   return updated;
// }

// /**
//  * DELETE /projects/:id
//  *
//  * TODO (backend):
//  *   await apiFetch<void>(`/projects/${id}`, { method: "DELETE" });
//  */
// export async function deleteProject(id: number): Promise<void> {
//   await delay();
//   _mockProjects = _mockProjects.filter((p) => p.id !== id);
// }

import { supabase } from "@/lib/supabase";

export async function fetchProjects() {
  const {
    data,
    error,
  } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return {
    data: data ?? [],
    total: data?.length ?? 0,
  };
}

export async function createProject(
  payload: {
    name: string;
  },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "User not authenticated",
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("projects")
    .insert({
      name: payload.name,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProject(
  id: string,
  payload: {
    name?: string;
  },
) {
  const {
    data,
    error,
  } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProject(
  id: string,
) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}