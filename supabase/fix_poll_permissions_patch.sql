-- =====================================================================
-- SYNCHRONA POLL PERMISSION HOTFIX
-- Apply this in Supabase SQL Editor if hosts can create days/activities
-- but creating a voting poll fails with:
--   new row violates row-level security policy for table "polls"
-- =====================================================================

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

  select rp.role
  into current_role
  from public.room_participants rp
  where rp.room_id = target_room_id
    and rp.user_id = target_user_id
  limit 1;

  if current_role is null then
    return false;
  end if;

  if current_role = 'HOST' then
    return true;
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

drop policy if exists "Editors can manage polls" on public.polls;
drop policy if exists "Users with poll permission can manage polls" on public.polls;

create policy "Users with poll permission can manage polls"
on public.polls
for all
to authenticated
using (
  exists (
    select 1
    from public.activity_blocks ab
    join public.days d on d.id = ab.day_id
    where ab.id = polls.activity_block_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_polls')
      )
  )
)
with check (
  exists (
    select 1
    from public.activity_blocks ab
    join public.days d on d.id = ab.day_id
    where ab.id = polls.activity_block_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_polls')
      )
  )
);

drop policy if exists "Editors can manage poll options" on public.poll_options;
drop policy if exists "Users with poll permission can manage poll options" on public.poll_options;

create policy "Users with poll permission can manage poll options"
on public.poll_options
for all
to authenticated
using (
  exists (
    select 1
    from public.polls p
    join public.activity_blocks ab on ab.id = p.activity_block_id
    join public.days d on d.id = ab.day_id
    where p.id = poll_options.poll_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_polls')
      )
  )
)
with check (
  exists (
    select 1
    from public.polls p
    join public.activity_blocks ab on ab.id = p.activity_block_id
    join public.days d on d.id = ab.day_id
    where p.id = poll_options.poll_id
      and (
        public.is_room_host(d.room_id, auth.uid())
        or public.can_room(d.room_id, auth.uid(), 'manage_polls')
      )
  )
);
