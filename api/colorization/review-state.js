import {
  buildMockSegments,
  defaultRolePalette,
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  sendError,
  sendJson,
} from './_shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;

  try {
    const projectId = req.query.projectId || req.query.project_id;
    const frameId = req.query.frameId || req.query.frame_id;
    const jobId = req.query.jobId || req.query.job_id || null;

    if (!projectId) return sendError(res, 400, 'projectId is required');
    if (!frameId) return sendError(res, 400, 'frameId is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);

    if (!job) {
      return sendJson(res, 200, { ok: true, has_review: false, job: null });
    }

    const { data: jobFrame, error: jobFrameError } = await supabase
      .from('colorization_job_frames')
      .select('*')
      .eq('job_id', job.id)
      .eq('frame_id', frameId)
      .maybeSingle();

    if (jobFrameError) throw jobFrameError;

    if (!jobFrame) {
      return sendJson(res, 200, { ok: true, has_review: false, job, job_frame: null });
    }

    const { data: frameRecord, error: frameError } = await supabase
      .from('frames')
      .select('*')
      .eq('id', frameId)
      .maybeSingle();

    if (frameError) throw frameError;

    const { data: roleMemory, error: roleMemoryError } = await supabase
      .from('role_memory')
      .select('*')
      .eq('project_id', projectId)
      .order('priority', { ascending: false });

    if (roleMemoryError) throw roleMemoryError;

    const { data: segmentRoles, error: segmentRoleError } = await supabase
      .from('frame_segment_roles')
      .select('*')
      .eq('project_id', projectId)
      .eq('job_id', job.id)
      .eq('frame_id', frameId);

    if (segmentRoleError) throw segmentRoleError;

    const roleBySegment = new Map((segmentRoles || []).map((row) => [Number(row.segment_id), row]));
    const summary = jobFrame.confidence_summary || {};
    const fallbackSegments = buildMockSegments(Number(jobFrame.frame_index ?? 0));
    const baseSegments = Array.isArray(summary.segments) && summary.segments.length
      ? summary.segments
      : fallbackSegments;

    const segments = baseSegments.map((segment) => {
      const saved = roleBySegment.get(Number(segment.segment_id));
      return {
        ...segment,
        segment_id: Number(segment.segment_id),
        role_id: saved?.role_id || segment.role_guess || 'unknown',
        color_hex: saved?.color_hex || segment.suggested_color || '#3B82F6',
        source: saved?.source || 'suggested',
        confirmed: Boolean(saved),
      };
    });

    const rolePalette = {};
    for (const row of roleMemory || []) {
      if (!rolePalette[row.role_id]) rolePalette[row.role_id] = [];
      rolePalette[row.role_id].push(row.locked_color);
    }

    return sendJson(res, 200, {
      ok: true,
      has_review: job.current_review_frame_id === frameId || jobFrame.pipeline_status === 'needs_review_not_reference',
      job,
      job_frame: jobFrame,
      frame: frameRecord,
      status: jobFrame.pipeline_status,
      preview_url: jobFrame.low_confidence_overlay_url || jobFrame.colorized_url || frameRecord?.colored_image_url || frameRecord?.source_image_url || null,
      frame_url: frameRecord?.source_image_url || null,
      result_url: jobFrame.colorized_url || frameRecord?.colored_image_url || null,
      palette: defaultRolePalette(roleMemory || []),
      role_palette: rolePalette,
      segments,
      reason: summary.reason || null,
      confidence_score: summary.confidence_score ?? null,
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to load review state', String(error?.message || error));
  }
}
