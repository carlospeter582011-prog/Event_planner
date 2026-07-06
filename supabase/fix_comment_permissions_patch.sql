-- =====================================================================
-- SYNCHRONA COMMENT PERMISSION HOTFIX
-- Apply this in Supabase SQL Editor if posting a room/timeline/activity
-- comment fails with:
--   new row violates row-level security policy for table "room_comments"
-- =====================================================================

create or replace function public.get_room_role(target_room_id uuid, target_user_id uuid)
returns public.role
language sql
stable
security definer
set search_path = public
as $$
  select rp.role
  from public.room_participants rp
  where rp.room_id = target_room_id
    and rp.user_id = target_user_id
  limit 1;
$$;

create or replace function public.is_room_host(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = target_room_id
      and r.host_id = target_user_id
  );
$$;

drop policy if exists "Participants can view room comments" on public.room_comments;
drop policy if exists "Participants can create room comments" on public.room_comments;
drop policy if exists "Room members can view room comments" on public.room_comments;
drop policy if exists "Room members can create room comments" on public.room_comments;
drop policy if exists "Users can delete own comments" on public.room_comments;
drop policy if exists "Comment moderators can delete comments" on public.room_comments;

create policy "Room members can view room comments"
on public.room_comments
for select
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.get_room_role(room_id, auth.uid()) is not null
);

create policy "Room members can create room comments"
on public.room_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_room_host(room_id, auth.uid())
    or public.get_room_role(room_id, auth.uid()) is not null
  )
);

create policy "Users can delete own comments"
on public.room_comments
for delete
to authenticated
using (user_id = auth.uid());

create policy "Comment moderators can delete comments"
on public.room_comments
for delete
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_comments')
);
