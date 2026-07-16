-- Lock down all application data not directly edited from the browser and
-- make the current public-image storage workflow explicit.

alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.colorization_jobs enable row level security;
alter table public.colorization_job_frames enable row level security;
alter table public.corrections enable row level security;
alter table public.frame_segment_roles enable row level security;
alter table public.role_memory enable row level security;
alter table public.vision_suggestions enable row level security;
alter table public.correction_masks enable row level security;
alter table public.creative_jobs enable row level security;

-- Read-only public plan catalogue. All plan writes remain service-role only.
drop policy if exists billing_plans_public_select on public.billing_plans;
create policy billing_plans_public_select on public.billing_plans for select
  using ((active and public_visible) or public.is_frameflow_admin());

-- Users may inspect their own billing history, but all writes happen through
-- the signed/idempotent billing API.
drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select on public.subscriptions for select
  using (user_id = auth.uid() or public.is_frameflow_admin());
drop policy if exists payment_orders_self_select on public.payment_orders;
create policy payment_orders_self_select on public.payment_orders for select
  using (user_id = auth.uid() or public.is_frameflow_admin());

-- Colorization data follows project ownership. Browser writes are intentionally
-- not granted; authenticated API routes use service_role after ownership checks.
drop policy if exists colorization_jobs_owner_select on public.colorization_jobs;
create policy colorization_jobs_owner_select on public.colorization_jobs for select using (
  exists(select 1 from public.projects p where p.id = colorization_jobs.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists colorization_job_frames_owner_select on public.colorization_job_frames;
create policy colorization_job_frames_owner_select on public.colorization_job_frames for select using (
  exists(select 1 from public.projects p where p.id = colorization_job_frames.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists corrections_owner_select on public.corrections;
create policy corrections_owner_select on public.corrections for select using (
  exists(select 1 from public.projects p where p.id = corrections.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists frame_segment_roles_owner_select on public.frame_segment_roles;
create policy frame_segment_roles_owner_select on public.frame_segment_roles for select using (
  exists(select 1 from public.projects p where p.id = frame_segment_roles.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists role_memory_owner_select on public.role_memory;
create policy role_memory_owner_select on public.role_memory for select using (
  exists(select 1 from public.projects p where p.id = role_memory.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists vision_suggestions_owner_select on public.vision_suggestions;
create policy vision_suggestions_owner_select on public.vision_suggestions for select using (
  exists(select 1 from public.projects p where p.id = vision_suggestions.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists correction_masks_owner_select on public.correction_masks;
create policy correction_masks_owner_select on public.correction_masks for select using (
  exists(select 1 from public.projects p where p.id = correction_masks.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);

drop policy if exists creative_jobs_self_select on public.creative_jobs;
create policy creative_jobs_self_select on public.creative_jobs for select
  using (user_id = auth.uid() or public.is_frameflow_admin());

-- The current canvas stores public URLs for source and colorized frames, so
-- these two buckets remain public. Creative outputs stay private and are read
-- through short-lived signed URLs returned by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('frames', 'frames', true, 26214400, array['image/png','image/jpeg','image/webp','image/gif']),
  ('colored-frames', 'colored-frames', true, 26214400, array['image/png','image/jpeg','image/webp','image/gif','application/json']),
  ('creative-assets', 'creative-assets', false, 26214400, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Source and colored object paths start with project_id. Users can modify only
-- objects whose first folder belongs to one of their projects.
drop policy if exists frameflow_frames_owner_insert on storage.objects;
create policy frameflow_frames_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists frameflow_frames_owner_update on storage.objects;
create policy frameflow_frames_owner_update on storage.objects for update to authenticated
using (
  bucket_id = 'frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists frameflow_frames_owner_delete on storage.objects;
create policy frameflow_frames_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);

drop policy if exists frameflow_colored_owner_insert on storage.objects;
create policy frameflow_colored_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'colored-frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists frameflow_colored_owner_update on storage.objects;
create policy frameflow_colored_owner_update on storage.objects for update to authenticated
using (
  bucket_id = 'colored-frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'colored-frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists frameflow_colored_owner_delete on storage.objects;
create policy frameflow_colored_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'colored-frames'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
