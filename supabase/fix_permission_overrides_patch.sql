-- =====================================================================
-- SYNCHRONA PERMISSION OVERRIDES HOTFIX
-- Apply this in Supabase SQL Editor if Host User Controller toggles fail with:
--   new row violates row-level security policy for table "room_permission_overrides"
-- =====================================================================

alter table public.room_permission_overrides
add column if not exists can_manage_settings boolean,
add column if not exists can_manage_budget boolean,
add column if not exists can_manage_itinerary boolean,
add column if not exists can_manage_polls boolean,
add column if not exists can_delete_polls boolean,
add column if not exists can_resolve_polls boolean,
add column if not exists can_manage_tasks boolean,
add column if not exists can_create_public_tasks boolean,
add column if not exists can_delete_items boolean,
add column if not exists can_manage_users boolean,
add column if not exists can_vote boolean,
add column if not exists can_chat boolean,
add column if not exists can_manage_chat boolean,
add column if not exists can_manage_comments boolean,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.room_permission_overrides enable row level security;

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

  if current_role = 'HOST' then
    return true;
  end if;

  select
    case permission_key
      when 'manage_settings' then can_manage_settings
      when 'manage_budget' then can_manage_budget
      when 'manage_itinerary' then can_manage_itinerary
      when 'manage_polls' then can_manage_polls
      when 'delete_polls' then can_delete_polls
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

drop policy if exists "Participants can view room permission overrides" on public.room_permission_overrides;
drop policy if exists "Hosts can manage room permission overrides" on public.room_permission_overrides;
drop policy if exists "Permission managers can manage room permission overrides" on public.room_permission_overrides;

create policy "Participants can view room permission overrides"
on public.room_permission_overrides
for select
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or exists (
    select 1
    from public.room_participants rp
    where rp.room_id = room_permission_overrides.room_id
      and rp.user_id = auth.uid()
  )
);

create policy "Permission managers can manage room permission overrides"
on public.room_permission_overrides
for all
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_users')
)
with check (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_users')
);
