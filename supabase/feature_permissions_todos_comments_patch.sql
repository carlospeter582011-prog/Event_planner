-- =====================================================================
-- SYNCHRONA FEATURE PATCH
-- Granular permissions, private/public to-dos, comments, chat moderation,
-- duplicate-safe room participation, and poll RLS fixes.
-- Run this after supabase/schema.sql in the Supabase SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Granular per-room permission overrides
-- ---------------------------------------------------------------------

create table if not exists public.room_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_manage_settings boolean,
  can_manage_budget boolean,
  can_manage_itinerary boolean,
  can_manage_polls boolean,
  can_resolve_polls boolean,
  can_manage_tasks boolean,
  can_create_public_tasks boolean,
  can_delete_items boolean,
  can_manage_users boolean,
  can_vote boolean,
  can_chat boolean,
  can_manage_chat boolean,
  can_manage_comments boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- If this table was created by an older patch, CREATE TABLE IF NOT EXISTS
-- will not add newly introduced columns. Keep this block for safe upgrades.
alter table public.room_permission_overrides
add column if not exists can_manage_settings boolean,
add column if not exists can_manage_budget boolean,
add column if not exists can_manage_itinerary boolean,
add column if not exists can_manage_polls boolean,
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

create index if not exists idx_room_permission_overrides_room
on public.room_permission_overrides(room_id);

create index if not exists idx_room_permission_overrides_user
on public.room_permission_overrides(user_id);

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
  exists (
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

-- ---------------------------------------------------------------------
-- Safer participant policies: users cannot overwrite their own role
-- ---------------------------------------------------------------------

drop policy if exists "Host or self can update participant" on public.room_participants;
drop policy if exists "Host can update participant roles" on public.room_participants;
drop policy if exists "Permission managers can update participants" on public.room_participants;

create policy "Permission managers can update participants"
on public.room_participants
for update
to authenticated
using (public.can_room(room_id, auth.uid(), 'manage_users'))
with check (public.can_room(room_id, auth.uid(), 'manage_users'));

-- ---------------------------------------------------------------------
-- Itinerary day/activity policies
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Private/public room to-dos
-- ---------------------------------------------------------------------

alter table public.tasks
add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
add column if not exists visibility text not null default 'PUBLIC',
add column if not exists completed_by uuid references public.profiles(id) on delete set null,
add column if not exists completed_at timestamptz,
add column if not exists updated_at timestamptz not null default now();

update public.tasks
set owner_id = coalesce(owner_id, (
  select r.host_id
  from public.rooms r
  where r.id = tasks.room_id
))
where owner_id is null;

alter table public.tasks
drop constraint if exists tasks_visibility_check;

alter table public.tasks
add constraint tasks_visibility_check
check (visibility in ('PUBLIC', 'PRIVATE'));

create index if not exists idx_tasks_room_visibility
on public.tasks(room_id, visibility);

create index if not exists idx_tasks_room_owner
on public.tasks(room_id, owner_id);

create or replace function public.handle_task_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.is_completed = true and old.is_completed = false then
    new.completed_at = now();
    new.completed_by = auth.uid();
  elsif new.is_completed = false and old.is_completed = true then
    new.completed_at = null;
    new.completed_by = null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_task_completion_change on public.tasks;

create trigger on_task_completion_change
before update on public.tasks
for each row
execute function public.handle_task_completion();

drop policy if exists "Participants can view tasks" on public.tasks;
drop policy if exists "Editors can manage tasks" on public.tasks;
drop policy if exists "Participants can view scoped tasks" on public.tasks;
drop policy if exists "Users can create scoped tasks" on public.tasks;
drop policy if exists "Owners or task managers can update tasks" on public.tasks;
drop policy if exists "Owners or task managers can delete tasks" on public.tasks;

create policy "Participants can view scoped tasks"
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.room_participants rp
    where rp.room_id = tasks.room_id
      and rp.user_id = auth.uid()
  )
  and (
    visibility = 'PUBLIC'
    or owner_id = auth.uid()
    or public.can_room(room_id, auth.uid(), 'manage_tasks')
  )
);

create policy "Users can create scoped tasks"
on public.tasks
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.room_participants rp
    where rp.room_id = tasks.room_id
      and rp.user_id = auth.uid()
  )
  and (
    visibility = 'PRIVATE'
    or public.can_room(room_id, auth.uid(), 'create_public_tasks')
  )
);

create policy "Owners or task managers can update tasks"
on public.tasks
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.can_room(room_id, auth.uid(), 'manage_tasks')
)
with check (
  owner_id = auth.uid()
  or public.can_room(room_id, auth.uid(), 'manage_tasks')
);

create policy "Owners or task managers can delete tasks"
on public.tasks
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.can_room(room_id, auth.uid(), 'manage_tasks')
);

-- ---------------------------------------------------------------------
-- Poll RLS fix and granular poll/vote policies
-- ---------------------------------------------------------------------

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

drop policy if exists "Participants can vote" on public.votes;
drop policy if exists "Users with vote permission can vote" on public.votes;

create policy "Users with vote permission can vote"
on public.votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.polls p on p.id = po.poll_id
    join public.activity_blocks ab on ab.id = p.activity_block_id
    join public.days d on d.id = ab.day_id
    where po.id = votes.poll_option_id
      and p.status = 'OPEN'
      and public.can_room(d.room_id, auth.uid(), 'vote')
  )
);

-- ---------------------------------------------------------------------
-- Chat moderation
-- ---------------------------------------------------------------------

drop policy if exists "Participants can view room messages" on public.room_messages;
drop policy if exists "Users with chat permission can view room messages" on public.room_messages;
drop policy if exists "Participants can send room messages" on public.room_messages;
drop policy if exists "Users with chat permission can send room messages" on public.room_messages;

create policy "Users with chat permission can view room messages"
on public.room_messages
for select
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'chat')
);

create policy "Users with chat permission can send room messages"
on public.room_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_room_host(room_id, auth.uid())
    or public.can_room(room_id, auth.uid(), 'chat')
  )
);

drop policy if exists "Users can delete own room messages" on public.room_messages;
drop policy if exists "Chat moderators can delete room messages" on public.room_messages;

create policy "Users can delete own room messages"
on public.room_messages
for delete
to authenticated
using (user_id = auth.uid());

create policy "Chat moderators can delete room messages"
on public.room_messages
for delete
to authenticated
using (
  public.is_room_host(room_id, auth.uid())
  or public.can_room(room_id, auth.uid(), 'manage_chat')
);

-- ---------------------------------------------------------------------
-- Generic room comments
-- ---------------------------------------------------------------------

create table if not exists public.room_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_comments_target_type_check
    check (target_type in ('ROOM', 'TIMELINE', 'ACTIVITY', 'BUDGET', 'TASK'))
);

create index if not exists idx_room_comments_target
on public.room_comments(room_id, target_type, target_id, created_at);

alter table public.room_comments enable row level security;

drop policy if exists "Participants can view room comments" on public.room_comments;
drop policy if exists "Participants can create room comments" on public.room_comments;
drop policy if exists "Users can delete own comments" on public.room_comments;
drop policy if exists "Comment moderators can delete comments" on public.room_comments;

create policy "Participants can view room comments"
on public.room_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.room_participants rp
    where rp.room_id = room_comments.room_id
      and rp.user_id = auth.uid()
  )
);

create policy "Participants can create room comments"
on public.room_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.room_participants rp
    where rp.room_id = room_comments.room_id
      and rp.user_id = auth.uid()
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
using (public.can_room(room_id, auth.uid(), 'manage_comments'));

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.room_permission_overrides;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_comments;
exception when duplicate_object then null;
end $$;
