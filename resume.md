# Synchrona Resume for New AI Chat

## Project Overview

Synchrona is a TestSprite Hackathon project: a real-time collaborative event planner for multi-day event rooms. Authenticated users can create secure rooms, invite others by full link or room code, build day-by-day itineraries, create activity voting polls, manage task checklists, track budget usage, and collaborate through room chat.

The app is a Next.js 16 App Router project with Supabase Auth, Supabase database tables/RLS/realtime, Tailwind CSS, and TestSprite frontend test plans.

## Current Repo and Deployment

- Workspace: `E:\Testsprite_H\Event_Planner`
- GitHub remote: `https://github.com/carlospeter582011-prog/Event_planner`
- Production URL: `https://event-planner-carlos.vercel.app`
- Latest pushed commit at the time of this file: `ae2a54f fix(room): make background refresh silent`
- Latest confirmed Vercel production deployment: `dpl_BikqP7RxgeuDdenEKp5mvB7fuDrS`
- Working tree was clean when this file was created.

## Environment

Supabase public config is present in `.env.example` and `.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL=https://ibmtcztrttjsngnqmagu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is configured locally and in Vercel production, preview, and development.

The app normalizes accidental Supabase URLs ending in `/rest/v1` in `lib/supabase/config.ts`.

## Important Project Rules

- After every edit turn, append a descriptive line to root `LOOP.md`.
- Test artifacts belong in `testsprite_tests/`.
- Build/test/fix cycles should be committed and pushed to `main`.
- Use TestSprite skill/workflow for website testing.
- Avoid committing `.env.local`; it is ignored.

## Implemented Features

### Auth

- Supabase email/password auth in `app/auth/signin/page.tsx`.
- Signup copy was changed so it does not tell users to check email after Supabase email confirmation is disabled.
- Supabase dashboard should have Email provider enabled and "Confirm email" turned off for easiest TestSprite testing.

### Dashboard and Room Creation

- Dashboard: `app/(protected)/dashboard/page.tsx` and `dashboard-client.tsx`.
- Room creation upserts a user profile before inserting a room. This repairs existing auth users that were missing rows in `profiles`, preventing FK failures on `rooms.host_id`.
- Users can create rooms and become `HOST`.

### Room Join and Invite

- Join modal accepts:
  - raw room code/slug
  - full `/rooms/{id-or-slug}` URL
  - `/join?slug=...` URL
- Parsing helper lives in `lib/utils.ts`:
  - `parseRoomIdentifier`
  - `isUuid`
- Invite button in room header opens a popup with:
  - invite link field
  - room code field
  - copy link
  - copy code
  - native share fallback
- Direct browser room URLs still work.

### Room Workspace

Room workspace lives under `app/(protected)/rooms/[roomId]/`.

Tabs:
- Timeline
- Tasks
- Budget
- Chat

Timeline supports days, activities, activity costs/status/location/time, voting polls, voting, and host poll resolution.

Tasks supports task creation, priority, due date, completion toggle, filters, and progress.

Budget shows budget cap, allocated, confirmed, remaining, usage bar, cost breakdown, and warning if over budget.

Chat tab exists in `chat-view.tsx` and depends on the `room_messages` SQL table.

### Realtime and Silent Refresh

Timeline, tasks, budget, and chat use Supabase realtime subscriptions where available.

Timeline/tasks/budget also poll every 5 seconds as a fallback, but now refresh silently:
- Initial tab load shows loader.
- Background polling does not call `setLoading(true)`.
- Users should not see "Loading timeline/tasks/budget" flicker during background refresh.

## Database State and SQL Notes

The full intended schema is in `supabase/schema.sql`.

If the live Supabase project is missing main tables, run the full schema from `supabase/schema.sql` in Supabase SQL Editor. A previous error showed `relation "public.room_participants" does not exist`, which means the schema had not been applied.

If main tables already exist but chat is missing, run this chat patch:

```sql
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_room_messages_room_created
on public.room_messages(room_id, created_at);

alter table public.room_messages enable row level security;

drop policy if exists "Participants can view room messages" on public.room_messages;
drop policy if exists "Participants can send room messages" on public.room_messages;

create policy "Participants can view room messages"
on public.room_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.room_participants rp
    where rp.room_id = room_messages.room_id
      and rp.user_id = auth.uid()
  )
);

create policy "Participants can send room messages"
on public.room_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.room_participants rp
    where rp.room_id = room_messages.room_id
      and rp.user_id = auth.uid()
  )
);

do $$
begin
  alter publication supabase_realtime add table public.room_messages;
exception
  when duplicate_object then null;
end $$;
```

## TestSprite

TestSprite project:
- ID: `e6c860f4-a64c-460c-bfbb-7a1475e7d64c`
- Name: `Synchrona`
- Production target: `https://event-planner-carlos.vercel.app`

Existing tests:
- Public smoke test: `f64fda4a-144a-4b90-9aa8-a822c1f2aedf`
- Authenticated full-site test: `305b4e20-b1f0-4646-b064-5f5d74eb7993`

Known passing run:
- Authenticated run `65f0747f-2b81-46bc-a3ea-2ec6679f04c5` passed after the profile self-heal room-creation fix.

Recent run:
- Run `45ae8c15-57c4-4ec4-bb28-8dd5622148fb` was started after SQL/chat changes but remained `running` after extended polling. It did not produce a pass/fail verdict during the previous chat.

Tracked plans:
- `testsprite_tests/synchrona_public_smoke.plan.json`
- `testsprite_tests/synchrona_authenticated_full_site.plan.json`
- `testsprite_tests/synchrona_phase5_smoke_test.md`

The authenticated plan now includes a full project description for TestSprite: room creation, invite controls, timeline, polls, tasks, budget, and chat.

Test account used by the user:
- Email: `carlospeter582011@gmail.com`
- Password: provided by the user in chat; avoid rewriting it in future artifacts unless strictly required.

## Commands

Build:

```powershell
npm run build
```

Run existing authenticated TestSprite test:

```powershell
testsprite test run 305b4e20-b1f0-4646-b064-5f5d74eb7993 --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app
```

Poll a specific TestSprite run:

```powershell
testsprite test wait <run-id> --timeout 360
```

Check Vercel deployments:

```powershell
vercel ls
vercel inspect <deployment-url>
```

## Recent Commit Summary

- `ae2a54f fix(room): make background refresh silent`
- `61f9043 feat(room): improve invites and live refresh`
- `9c2b7bb test(testsprite): record authenticated flow pass`
- `59beead fix(room): ensure profile before creation`
- `8102eee test(testsprite): add authenticated full site plan`
- `130c892 fix(auth): update signup success copy`
- `5236c4f chore(config): wire supabase public env example`

## Recommended Next Steps

1. Confirm the full schema exists in Supabase, especially `rooms`, `room_participants`, `days`, `activity_blocks`, `tasks`, and `room_messages`.
2. Rerun the authenticated TestSprite test after schema confirmation.
3. If TestSprite hangs again, inspect artifacts or create a narrower plan for:
   - login
   - create room
   - open invite popup
   - paste full invite link into join modal
   - open chat and send message
4. Consider adding structured comments per activity/task if requested. This needs new SQL tables such as `activity_comments` or a polymorphic `comments` table.
5. Keep app refresh behavior invisible during background polling.
