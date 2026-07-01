import {
  FRAME_PIPELINE_STATUS,
  JOB_STATUS,
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  normalizeCorrectionList,
  readJsonBody,
  sendError,
  sendJson,
} from './_shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const frameId = body.frameId || body.frame_id;
    const jobId = body.jobId || body.job_id || null;
    const resultUrl = body.resultUrl || body.result_url || null;
    const previewUrl = body.previewUrl || body.preview_url || null;
    const propagateAfter = body.propagateAfter ?? body.propagate_after ?? true;

    if (!projectId) return sendError(res, 400, 'projectId is required');
    if (!frameId) return sendError(res, 400, 'frameId is required');

    const corrections = normalizeCorrectionList(body);
    if (!corrections.length) return sendError(res, 400, 'At least one correction is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);

    if (!job) return sendError(res, 404, 'No colorization job found for this project');

    const { data: frame, error: frameError } = await supabase
      .from('frames')
      .select('*')
      .eq('id', frameId)
      .single();

    if (frameError) throw frameError;

    const finalResultUrl = resultUrl || frame.colored_image_url || frame.source_image_url;

    const { data: correctionRow, error: correctionError } = await supabase
      .from('corrections')
      .insert({
        project_id: projectId,
        job_id: job.id,
        frame_id: frameId,
        method: 'right_panel_review',
        propagate_after: Boolean(propagateAfter),
        became_keyframe: true,
        corrections,
        preview_url: previewUrl || finalResultUrl,
        result_url: finalResultUrl,
      })
      .select('*')
      .single();

    if (correctionError) throw correctionError;

    for (const item of corrections) {
      const roleId = item.role_id || 'unknown';

      const { error: segmentRoleError } = await supabase
        .from('frame_segment_roles')
        .upsert({
          project_id: projectId,
          job_id: job.id,
          frame_id: frameId,
          segment_id: item.segment_id,
          role_id: roleId,
          color_hex: item.color_hex,
          source: item.source || 'user_manual',
          confidence: item.confidence ?? 1.0,
          metadata: {
            ...item.metadata,
            correction_id: correctionRow.id,
            palette_locked: item.palette_locked,
          },
        }, { onConflict: 'job_id,frame_id,segment_id' });

      if (segmentRoleError) throw segmentRoleError;

      if (item.palette_locked && roleId !== 'unknown') {
        const { error: roleError } = await supabase
          .from('role_memory')
          .upsert({
            project_id: projectId,
            role_id: roleId,
            display_name: roleId.replaceAll('_', ' '),
            locked_color: item.color_hex,
            source: 'user_confirmed',
            source_frame_id: frameId,
            source_segment_id: item.segment_id,
            is_locked: true,
            priority: 80,
            metadata: {
              correction_id: correctionRow.id,
            },
          }, { onConflict: 'project_id,role_id' });

        if (roleError) throw roleError;
      }
    }

    const { error: updateFrameError } = await supabase
      .from('frames')
      .update({
        colored_image_url: finalResultUrl,
        status: 'correction_keyframe',
      })
      .eq('id', frameId);

    if (updateFrameError) throw updateFrameError;

    const { data: updatedJobFrame, error: updateJobFrameError } = await supabase
      .from('colorization_job_frames')
      .update({
        pipeline_status: FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME,
        colorized_url: finalResultUrl,
        confidence_summary: {
          status: 'user_corrected',
          correction_id: correctionRow.id,
          corrections,
          confidence_score: 1.0,
        },
      })
      .eq('job_id', job.id)
      .eq('frame_id', frameId)
      .select('*')
      .single();

    if (updateJobFrameError) throw updateJobFrameError;

    const processingFrameIds = Array.isArray(job.settings?.processing_frame_ids)
      ? job.settings.processing_frame_ids.map(String)
      : [];
    const currentCursor = processingFrameIds.length
      ? processingFrameIds.indexOf(String(frameId))
      : -1;
    const nextFrameIndex = currentCursor >= 0
      ? currentCursor + 1
      : Number(updatedJobFrame.frame_index ?? frame.frame_index ?? 0) + 1;

    const { data: updatedJob, error: updateJobError } = await supabase
      .from('colorization_jobs')
      .update({
        status: propagateAfter ? JOB_STATUS.RUNNING : JOB_STATUS.WAITING_REVIEW,
        current_review_frame_id: null,
        last_trusted_frame_id: frameId,
        next_frame_index: nextFrameIndex,
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (updateJobError) throw updateJobError;

    return sendJson(res, 200, {
      ok: true,
      status: FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME,
      job: updatedJob,
      job_frame: updatedJobFrame,
      correction: correctionRow,
      result_url: finalResultUrl,
      message: 'Correction saved. This frame is now the latest correction keyframe.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to apply correction', String(error?.message || error));
  }
}
