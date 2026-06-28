import {
  FRAME_PIPELINE_STATUS,
  JOB_STATUS,
  buildMockSegments,
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from './_shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const jobId = body.jobId || body.job_id || null;

    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);

    if (!job) return sendError(res, 404, 'No colorization job found for this project');

    if (job.current_review_frame_id) {
      return sendJson(res, 200, {
        ok: true,
        status: JOB_STATUS.WAITING_REVIEW,
        job,
        message: 'Pipeline is waiting for user correction before continuing.',
      });
    }

    const nextIndex = Number(job.next_frame_index ?? 0);

    const { data: nextFrame, error: nextError } = await supabase
      .from('colorization_job_frames')
      .select('*')
      .eq('job_id', job.id)
      .gte('frame_index', nextIndex)
      .eq('pipeline_status', FRAME_PIPELINE_STATUS.PENDING)
      .order('frame_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) throw nextError;

    if (!nextFrame) {
      const { data: completedJob, error: completeError } = await supabase
        .from('colorization_jobs')
        .update({
          status: JOB_STATUS.COMPLETED,
          current_review_frame_id: null,
        })
        .eq('id', job.id)
        .select('*')
        .single();

      if (completeError) throw completeError;

      return sendJson(res, 200, {
        ok: true,
        status: JOB_STATUS.COMPLETED,
        job: completedJob,
        message: 'All frames completed.',
      });
    }

    const { data: frameRecord, error: frameError } = await supabase
      .from('frames')
      .select('*')
      .eq('id', nextFrame.frame_id)
      .maybeSingle();

    if (frameError) throw frameError;

    const sourceUrl = frameRecord?.source_image_url || frameRecord?.colored_image_url || nextFrame.colorized_url || null;
    const mockSegments = buildMockSegments(Number(nextFrame.frame_index ?? 0));

    // This is the first production-safe integration mode:
    // it pauses on the next frame and asks the user to confirm/fix segments.
    // Replace this block later with real CV propagation + AI confidence check.
    const confidenceSummary = {
      mode: 'review_required_stub',
      reason: 'No production propagation engine configured yet. Pausing for human-in-the-loop correction.',
      confidence_score: 0.61,
      low_confidence_count: mockSegments.length,
      segments: mockSegments,
      reference_used_frame_id: job.last_trusted_frame_id,
    };

    const { data: updatedJobFrame, error: updateFrameError } = await supabase
      .from('colorization_job_frames')
      .update({
        pipeline_status: FRAME_PIPELINE_STATUS.NEEDS_REVIEW,
        reference_used_frame_id: job.last_trusted_frame_id,
        low_confidence_count: mockSegments.length,
        confidence_summary: confidenceSummary,
        low_confidence_overlay_url: sourceUrl,
      })
      .eq('id', nextFrame.id)
      .select('*')
      .single();

    if (updateFrameError) throw updateFrameError;

    const { data: updatedJob, error: updateJobError } = await supabase
      .from('colorization_jobs')
      .update({
        status: JOB_STATUS.WAITING_REVIEW,
        current_review_frame_id: nextFrame.frame_id,
        next_frame_index: Number(nextFrame.frame_index ?? 0),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (updateJobError) throw updateJobError;

    return sendJson(res, 200, {
      ok: true,
      status: FRAME_PIPELINE_STATUS.NEEDS_REVIEW,
      job: updatedJob,
      job_frame: updatedJobFrame,
      frame_id: nextFrame.frame_id,
      message: 'Frame needs review. Open RightPanel Review/Correction.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to continue colorization job', String(error?.message || error));
  }
}
