export type PipelineStatus =
  | "pending"
  | "processing"
  | "colorized"
  | "needs_review_not_reference"
  | "correcting"
  | "correction_applied"
  | "correction_keyframe"
  | "completed"
  | "failed";

export type ColorizationJob = {
  id: string;
  project_id: string;
  status: string;
  current_review_frame_id?: string | null;
  last_trusted_frame_id?: string | null;
  next_frame_index?: number | null;
  settings?: Record<string, unknown>;
};

export type ColorizationJobFrame = {
  id: string;
  job_id: string;
  project_id: string;
  frame_id: string;
  frame_index: number;
  frame_name?: string | null;
  pipeline_status: PipelineStatus;
  reference_used_frame_id?: string | null;
  low_confidence_count?: number | null;
  confidence_summary?: Record<string, unknown>;
  colorized_url?: string | null;
  low_confidence_overlay_url?: string | null;
  segment_ids_url?: string | null;
  segments_json_url?: string | null;
  labels_asset_url?: string | null;
};

export type ReviewSegment = {
  segment_id: number;
  role_guess?: string | null;
  role_id?: string | null;
  color_hex?: string | null;
  suggested_color?: string | null;
  confidence?: number | null;
  source?: string | null;
  confirmed?: boolean;
  reason?: string | null;
};

export type ReviewState = {
  ok: boolean;
  has_review: boolean;
  job: ColorizationJob | null;
  job_frame?: ColorizationJobFrame | null;
  frame?: Record<string, unknown> | null;
  status?: PipelineStatus;
  preview_url?: string | null;
  frame_url?: string | null;
  result_url?: string | null;
  palette: string[];
  role_palette: Record<string, string[]>;
  segments: ReviewSegment[];
  reason?: string | null;
  confidence_score?: number | null;
};

export type CorrectionItem = {
  segment_id: number;
  role_id: string;
  color_hex: string;
  palette_locked: boolean;
  source?: "user_manual" | "palette" | "eyedropper" | "color_picker" | "vision_ai" | "mask_repair";
  metadata?: Record<string, unknown>;
};

const API_BASE = import.meta.env.VITE_BACKEND_API_BASE_URL || "";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || data?.details || `Request failed: ${res.status}`);
  }

  return data as T;
}

export async function startColorizationJob(input: {
  projectId: string;
  referenceFrameId?: string | null;
  targetFrameIds?: string[];
  direction?: "forward" | "backward" | "both";
}) {
  return requestJson<{
    ok: boolean;
    job: ColorizationJob;
    reference_frame: Record<string, unknown>;
    total_frames: number;
    message: string;
  }>("/api/colorization/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getColorizationState(input: {
  projectId: string;
  jobId?: string | null;
}) {
  const params = new URLSearchParams({ projectId: input.projectId });
  if (input.jobId) params.set("jobId", input.jobId);

  return requestJson<{
    ok: boolean;
    job: ColorizationJob | null;
    frames: ColorizationJobFrame[];
  }>(`/api/colorization/state?${params.toString()}`);
}

export async function continueColorizationJob(input: {
  projectId: string;
  jobId?: string | null;
  maxSteps?: number;
}) {
  return requestJson<{
    ok: boolean;
    status: string;
    job: ColorizationJob;
    job_frame?: ColorizationJobFrame;
    frame_id?: string;
    result_url?: string;
    overlay_url?: string;
    processed_count?: number;
    processed?: Array<Record<string, unknown>>;
    message: string;
  }>("/api/colorization/continue", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getFrameReviewState(input: {
  projectId: string;
  frameId: string;
  jobId?: string | null;
}) {
  const params = new URLSearchParams({
    projectId: input.projectId,
    frameId: input.frameId,
  });
  if (input.jobId) params.set("jobId", input.jobId);

  return requestJson<ReviewState>(`/api/colorization/review-state?${params.toString()}`);
}

export async function applyFrameCorrection(input: {
  projectId: string;
  jobId?: string | null;
  frameId: string;
  corrections: CorrectionItem[];
  resultUrl?: string | null;
  previewUrl?: string | null;
  propagateAfter?: boolean;
}) {
  return requestJson<{
    ok: boolean;
    status: string;
    job: ColorizationJob;
    job_frame: ColorizationJobFrame;
    correction: Record<string, unknown>;
    result_url: string;
    message: string;
  }>("/api/colorization/apply-correction", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getVisionSuggestion(input: {
  projectId: string;
  jobId?: string | null;
  frameId: string;
  segmentId: number;
}) {
  return requestJson<{
    ok: boolean;
    suggestion: {
      id: string;
      role_id: string;
      segment_ids: number[];
      color_hex: string;
      confidence: number;
      status: string;
    };
  }>("/api/colorization/vision-suggest", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function saveMaskRepair(input: {
  projectId: string;
  jobId?: string | null;
  frameId: string;
  maskUrl: string;
  roleId?: string | null;
  colorHex?: string | null;
  sourceSegmentIds?: number[];
  maskSource?: string;
}) {
  return requestJson<{
    ok: boolean;
    mask: Record<string, unknown>;
    message: string;
  }>("/api/colorization/mask-repair", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
