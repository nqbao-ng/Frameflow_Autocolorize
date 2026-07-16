import { ensureMethod, readJsonBody, sendError, sendJson } from '../server/stability-shared.js';
import {
  ensureProjectOwnership,
  getEntitlements,
  getSupabaseAdmin,
  requireUser,
} from '../server/account-shared.js';

const PROJECT_SELECT = `
  id,
  name,
  status,
  thumbnail_url,
  archived_at,
  created_at,
  updated_at,
  frames (
    id,
    frame_index,
    source_image_url,
    colored_image_url,
    status,
    created_at
  ),
  colorization_jobs (
    id,
    status,
    current_review_frame_id,
    error_message,
    created_at,
    updated_at
  )
`;

function cleanProjectName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    const error = new Error('Project name is required');
    error.statusCode = 400;
    throw error;
  }
  if (name.length > 100) {
    const error = new Error('Project name must be 100 characters or fewer');
    error.statusCode = 400;
    throw error;
  }
  return name;
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      let query = supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('user_id', user.id);
      if (id) query = query.eq('id', id).maybeSingle();
      else query = query.is('archived_at', null).order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return sendJson(res, 200, { ok: true, projects: id ? (data ? [data] : []) : (data || []) });
    }

    const body = await readJsonBody(req);
    if (req.method === 'POST') {
      const before = await getEntitlements(supabase, user.id);
      const { data: created, error: createError } = await supabase.rpc('create_frameflow_project', {
        p_user_id: user.id,
        p_name: cleanProjectName(body.name),
        p_project_limit: before.limits.projects,
      });
      if (createError) throw createError;
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('id', created.id)
        .single();
      if (error) throw error;
      const entitlements = await getEntitlements(supabase, user.id);
      return sendJson(res, 201, { ok: true, project: data, entitlements });
    }

    const id = String(body.id || req.query?.id || '').trim();
    if (!id) {
      const error = new Error('Project id is required');
      error.statusCode = 400;
      throw error;
    }
    await ensureProjectOwnership(supabase, user.id, id);

    if (req.method === 'PATCH') {
      const update = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) update.name = cleanProjectName(body.name);
      if (body.archived === true) update.archived_at = new Date().toISOString();
      if (body.archived === false) {
        const entitlements = await getEntitlements(supabase, user.id);
        const { data: restored, error: restoreError } = await supabase.rpc('restore_frameflow_project', {
          p_user_id: user.id,
          p_project_id: id,
          p_project_limit: entitlements.limits.projects,
        });
        if (restoreError) throw restoreError;
        const { data, error } = await supabase
          .from('projects')
          .select(PROJECT_SELECT)
          .eq('id', restored.id)
          .single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, project: data });
      }
      const { data, error } = await supabase
        .from('projects')
        .update(update)
        .eq('id', id)
        .eq('user_id', user.id)
        .select(PROJECT_SELECT)
        .single();
      if (error) throw error;
      return sendJson(res, 200, { ok: true, project: data });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    const status = message.includes('PROJECT_LIMIT_REACHED') ? 402 : Number(error?.statusCode) || 500;
    return sendError(res, status, 'Project request failed', error?.details || message);
  }
}
