-- =====================================================================
-- SYNCHRONA ITINERARY PERMISSION HOTFIX
-- Apply this in Supabase SQL Editor if creating days or activities fails with:
--   new row violates row-level security policy for table "days"
-- or:
--   new row violates row-level security policy for table "activity_blocks"
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

create or replace function public.can_room(
  target_room_id uuid,
  target_user_id uuid,
  permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role public.role;
  override_value boolean;
begin
  if public.is_room_host(target_room_id, target_user_id) then
    return true;
  end if;

  select public.get_room_role(target_room_id, target_user_id)
  into current_role;

  if current_role is null then
    return false;
  end if;

  select
    case permission_key
      when 'manage_settings' then can_manage_settings
      when 'manage_budget' then can_manage_budget
      when 'manage_itinerary' then can_manage_itinerary
      when 'manage_polls' then can_manage_polls
      when 'resolve_polls' then can_resolve_polls
      when 'manage_tasks' then can_manage_tasks
      when 'create_public_tasks' then can_create_public_tasks
      when 'delete_items' then can_delete_items
      when 'manage_users' then can_manage_users
      when 'vote' then can_vote
      when 'chat' then can_chat
      when 'manage_chat' then can_manage_chat
      when 'manage_comments' then can_manage_comments
      else null
    end
  into override_value
  from public.room_permission_overrides
  where room_id = target_room_id
    and user_id = target_user_id;

  if override_value is not null then
    return override_value;
  end if;

  if current_role = 'HOST' then
    return true;
  end if;

  if current_role = 'EDITOR' then
    return permission_key in (
      'manage_itinerary',
      'manage_polls',
      'manage_tasks',
      'create_public_tasks',
      'vote',
      'chat'
    );
  end if;

  if current_role = 'VIEWER' then
    return permission_key in ('vote', 'chat');
  end if;

  return false;
end;
$$;

drop policy if exists "Participants can view days" on public.days;
drop policy if exists "Editors can manage days" on public.days;
drop policy if exists "Users with itinerary permission can view days" on public.days;
drop policy if exists "Users with itinerary permission can manage days" on public.days;

create policy "Users with itinerary permission can view days"
on public.days
for select
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.get_room_role(room_id, auth.uid()) is not null
);

create policy "Users with itinerary permission can manage days"
on public.days
for all
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_itinerary')
)
with check (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_itinerary')
);

drop policy if exists "Participants can view activities" on public.activity_blocks;
drop policy if exists "Editors can manage activities" on public.activity_blocks;
drop policy if exists "Users with itinerary permission can view activities" on public.activity_blocks;
drop policy if exists "Users with itinerary permission can manage activities" on public.activity_blocks;

create policy "Users with itinerary permission can view activities"
on public.activity_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.days d
    where d.id = activity_blocks.day_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.get_room_role(d.room_id, auth.uid()) is not null
      )
  )
);

create policy "Users with itinerary permission can manage activities"
on public.activity_blocks
for all
to authenticated
using (
  exists (
    select 1
    from public.days d
    where d.id = activity_blocks.day_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_itinerary')
      )
  )
)
with check (
  exists (
    select 1
    from public.days d
    where d.id = activity_blocks.day_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_itinerary')
      )
  )
);
