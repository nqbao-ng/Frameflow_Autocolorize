import { supabase } from "@/lib/supabase";
import type {
  Project,
  ProjectStatus,
  ProjectsApiResponse,
  CreateProjectPayload,
  UpdateProjectPayload,
} from "../types";

type FrameRow = {
  id: string;
  frame_index?: number | null;
  source_image_url?: string | null;
  colored_image_url?: string | null;
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
};

function deriveStatus(frameCount: number, coloredFrameCount: number): ProjectStatus {
  if (frameCount === 0) return "draft";
  if (coloredFrameCount >= frameCount) return "complete";
  return "in-progress";
}

function mapProject(row: ProjectRow): Project {
  const frames = Array.isArray(row.frames) ? row.frames : [];
  const orderedFrames = [...frames].sort(
    (a, b) => (a.frame_index ?? Number.MAX_SAFE_INTEGER) - (b.frame_index ?? Number.MAX_SAFE_INTEGER),
  );
  const coloredFrames = orderedFrames.filter((frame) => Boolean(frame.colored_image_url)).length;
  const thumbnail =
    row.thumbnail_url ||
    orderedFrames.find((frame) => frame.colored_image_url)?.colored_image_url ||
    orderedFrames.find((frame) => frame.source_image_url)?.source_image_url ||
    "";

  return {
    id: row.id,
    name: row.name,
    frames: orderedFrames.length,
    coloredFrames,
    status: deriveStatus(orderedFrames.length, coloredFrames),
    lastEdited: row.updated_at || row.created_at || new Date(0).toISOString(),
    thumbnail,
  };
}

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("User not authenticated");
  return data.user;
}

const PROJECT_SELECT = `
  id,
  name,
  status,
  thumbnail_url,
  created_at,
  updated_at,
  frames (
    id,
    frame_index,
    source_image_url,
    colored_image_url,
    created_at,
    updated_at
  )
`;

export async function fetchProjects(): Promise<ProjectsApiResponse> {
  const user = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const projects = (data ?? []).map((row) => mapProject(row as ProjectRow));
  return { data: projects, total: projects.length };
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const user = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: payload.name, user_id: user.id })
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;
  return mapProject(data as ProjectRow);
}

export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
  const user = await requireAuthenticatedUser();
  const databasePayload: Record<string, unknown> = {};
  if (payload.name !== undefined) databasePayload.name = payload.name;

  const { data, error } = await supabase
    .from("projects")
    .update(databasePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;
  return mapProject(data as ProjectRow);
}

export async function deleteProject(id: string): Promise<void> {
  const user = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
