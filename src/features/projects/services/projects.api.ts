import { supabase } from "@/lib/supabase";
import { notifyEntitlementsChanged } from "@/features/account/services/entitlements.api";
import type { Project, ProjectStatus, ProjectsApiResponse, CreateProjectPayload, UpdateProjectPayload } from "../types";

type FrameRow = {
  id: string;
  frame_index?: number | null;
  source_image_url?: string | null;
  colored_image_url?: string | null;
};

type JobRow = {
  id: string;
  status?: string | null;
  current_review_frame_id?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status?: string | null;
  thumbnail_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  frames?: FrameRow[] | null;
  colorization_jobs?: JobRow[] | null;
};

async function authenticatedRequest(path: string, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    const message = payload?.details || payload?.error || `Project request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
}

function latestJob(jobs: JobRow[]): JobRow | null {
  return [...jobs].sort((a, b) => {
    const right = new Date(b.updated_at || b.created_at || 0).getTime();
    const left = new Date(a.updated_at || a.created_at || 0).getTime();
    return right - left;
  })[0] || null;
}

function deriveStatus(row: ProjectRow, frameCount: number, coloredFrameCount: number, job: JobRow | null): ProjectStatus {
  const jobStatus = String(job?.status || "").toLowerCase();
  if (["created", "queued", "running", "processing"].includes(jobStatus)) return "processing";
  if (["waiting_review", "needs_review", "needs_review_not_reference", "paused_review"].includes(jobStatus)) return "needs-review";
  if (["failed", "error"].includes(jobStatus)) return "failed";
  if (["cancelled", "canceled"].includes(jobStatus)) return coloredFrameCount > 0 ? "ready" : "draft";
  if (jobStatus === "completed" || (frameCount > 0 && coloredFrameCount >= frameCount)) return "complete";
  if (frameCount > 0) return "ready";
  return row.status === "failed" ? "failed" : "draft";
}

function mapProject(row: ProjectRow): Project {
  const frames = Array.isArray(row.frames) ? row.frames : [];
  const orderedFrames = [...frames].sort((a, b) => (a.frame_index ?? Number.MAX_SAFE_INTEGER) - (b.frame_index ?? Number.MAX_SAFE_INTEGER));
  const coloredFrames = orderedFrames.filter((frame) => Boolean(frame.colored_image_url)).length;
  const job = latestJob(Array.isArray(row.colorization_jobs) ? row.colorization_jobs : []);
  return {
    id: row.id,
    name: row.name,
    frames: orderedFrames.length,
    coloredFrames,
    status: deriveStatus(row, orderedFrames.length, coloredFrames, job),
    lastEdited: job?.updated_at || row.updated_at || row.created_at || new Date(0).toISOString(),
    thumbnail: row.thumbnail_url || orderedFrames.find((frame) => frame.colored_image_url)?.colored_image_url || orderedFrames.find((frame) => frame.source_image_url)?.source_image_url || "",
    currentReviewFrameId: job?.current_review_frame_id || null,
    errorMessage: job?.error_message || null,
  };
}

export async function fetchProjects(): Promise<ProjectsApiResponse> {
  const payload = await authenticatedRequest("/api/projects");
  const projects = (payload.projects || []).map((row: ProjectRow) => mapProject(row));
  return { data: projects, total: projects.length };
}

export async function createProject(input: CreateProjectPayload): Promise<Project> {
  const payload = await authenticatedRequest("/api/projects", { method: "POST", body: JSON.stringify(input) });
  notifyEntitlementsChanged();
  return mapProject(payload.project as ProjectRow);
}

export async function updateProject(id: string, input: UpdateProjectPayload): Promise<Project> {
  const payload = await authenticatedRequest("/api/projects", { method: "PATCH", body: JSON.stringify({ id, ...input }) });
  notifyEntitlementsChanged();
  return mapProject(payload.project as ProjectRow);
}

export async function deleteProject(id: string): Promise<void> {
  await authenticatedRequest("/api/projects", { method: "DELETE", body: JSON.stringify({ id }) });
  notifyEntitlementsChanged();
}
