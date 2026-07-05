# Synchrona Resume for New AI Chat

## Project Overview

Synchrona is a TestSprite Hackathon project: a real-time collaborative event planner for multi-day event rooms. Authenticated users can create secure rooms, invite others by full link or room code, build day-by-day itineraries, create activity voting polls with expandable options, manage private/public to-do lists, write comments across room surfaces, track budget usage, and collaborate through moderated room chat.

The app is a Next.js 16 App Router project with Supabase Auth, Supabase database tables/RLS/realtime, Tailwind CSS, and TestSprite frontend test plans.

## Current Repo and Deployment

- Workspace: `E:\Testsprite_H\Event_Planner`
- GitHub remote: `https://github.com/carlospeter582011-prog/Event_planner`
- Production URL: `https://event-planner-carlos.vercel.app`
- Latest pushed commit at the time of this file: `d8e7302 fix(sql): allow hosts to manage permission overrides`
- Latest verified local build: `npm run build` passed after `384107d fix(budget): contain huge currency values`.
- Working tree was clean when this file was updated.

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
- Joining a room the user is already in no longer upserts `VIEWER` and no longer overwrites the user's existing role.

### Room Workspace

Room workspace lives under `app/(protected)/rooms/[roomId]/`.

Tabs:
- Command
- Timeline
- Tasks
- Budget
- Chat

Command Center summarizes room health for TestSprite and human reviewers:
- readiness score
- open poll count
- task completion progress
- budget health
- live verification checklist
- participant permission matrix

Timeline supports days, activities, activity costs/status/location/time, voting polls, voting, and host poll resolution.

Timeline now also has timeline-level comments and per-activity comments through `comments-panel.tsx`.

Polls now support more than five options by using the `Add option` control. The previous 2-to-5 option limit was removed.

Tasks now supports private and public room to-dos:
- private to-dos are owned by a single user
- public to-dos are room-visible
- public to-do creation is controlled by the `create_public_tasks` permission
- to-dos have checkboxes, filters, owner-aware mutation controls, and comments

Budget shows budget cap, allocated, confirmed, remaining, usage bar, cost breakdown, warning if over budget, and budget comments.

Budget UI was hardened so very large currency values stay inside their cards using zero-min grid tracks, forced wrapping, and overflow constraints.

Chat tab exists in `chat-view.tsx` and depends on the `room_messages` SQL table. Users can delete their own messages. Users with `manage_chat` can delete any message and clear the whole room chat.

Generic comments are implemented in `app/(protected)/rooms/[roomId]/comments-panel.tsx` for timeline, activities, budget, and to-dos. Users can delete their own comments. Users with `manage_comments` can delete any comment and clear comments for a surface.

Host controls now use granular permission toggles in `participant-sidebar.tsx`, not just Editor/Viewer role selection. The host clicks one participant in the participant list and the Host User Controller shows only that selected participant's permissions.

Granular permission keys currently used in the app:
- `manage_settings`
- `manage_budget`
- `manage_itinerary`
- `manage_polls`
- `resolve_polls`
- `manage_tasks`
- `create_public_tasks`
- `delete_items`
- `manage_users`
- `vote`
- `chat`
- `manage_chat`
- `manage_comments`

### Realtime and Silent Refresh

Timeline, tasks, budget, and chat use Supabase realtime subscriptions where available.

Timeline/tasks/budget also poll every 5 seconds as a fallback, but now refresh silently:
- Initial tab load shows loader.
- Background polling does not call `setLoading(true)`.
- Users should not see "Loading timeline/tasks/budget" flicker during background refresh.

## Database State and SQL Notes

The full intended schema is in `supabase/schema.sql`.

If the live Supabase project is missing main tables, run the full schema from `supabase/schema.sql` in Supabase SQL Editor. A previous error showed `relation "public.room_participants" does not exist`, which means the schema had not been applied.

After running `supabase/schema.sql`, run the newest feature patch:

```powershell
supabase/feature_permissions_todos_comments_patch.sql
```

That patch adds or updates:
- `room_permission_overrides`
- permission helper functions: `get_room_role`, `is_room_host`, `can_room`
- private/public task columns and task RLS
- poll and poll option RLS fixes
- vote RLS using `can_room`
- chat send/delete moderation policies
- `room_comments`
- realtime publication entries for new tables

Important SQL history:
- `6595b73 fix(sql): add missing permission columns` added `alter table ... add column if not exists` because older deployments already had `room_permission_overrides` without newer columns such as `can_create_public_tasks`.
- `d8e7302 fix(sql): allow hosts to manage permission overrides` fixed `new row violates row-level security policy for table "room_permission_overrides"` by allowing direct room hosts via `is_room_host(...)` in the override management policy.

If Supabase reports missing permission columns or RLS failures for `room_permission_overrides`, rerun the full `feature_permissions_todos_comments_patch.sql` file.

## TestSprite

TestSprite project:
- ID: `e6c860f4-a64c-460c-bfbb-7a1475e7d64c`
- Name: `Synchrona`
- Production target: `https://event-planner-carlos.vercel.app`

Existing tests:
- Public smoke test: `f64fda4a-144a-4b90-9aa8-a822c1f2aedf`
- Authenticated full-site test: `305b4e20-b1f0-4646-b064-5f5d74eb7993`

The authenticated plan has been expanded to cover the Command Center, readiness metrics, permission matrix, granular Host User Controller toggles, expandable poll options, private/public to-dos, comments, budget comments, chat moderation, and duplicate-room join protection.

Known passing run:
- Authenticated run `65f0747f-2b81-46bc-a3ea-2ec6679f04c5` passed after the profile self-heal room-creation fix.

Recent run:
- Run `45ae8c15-57c4-4ec4-bb28-8dd5622148fb` was started after SQL/chat changes but remained `running` after extended polling. It did not produce a pass/fail verdict during the previous chat.

Tracked plans:
- `testsprite_tests/README.md`
- `testsprite_tests/synchrona_public_smoke.plan.json`
- `testsprite_tests/synchrona_authenticated_full_site.plan.json`
- `testsprite_tests/synchrona_command_center_host_controls.plan.json`
- `testsprite_tests/synchrona_phase5_smoke_test.md`

The authenticated plan now includes a full project description for TestSprite: room creation, invite controls, Command Center, granular permissions, timeline, polls, private/public to-dos, comments, budget, and chat moderation.

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

- `d8e7302 fix(sql): allow hosts to manage permission overrides`
- `384107d fix(budget): contain huge currency values`
- `6595b73 fix(sql): add missing permission columns`
- `1a5cb51 fix(room): improve budget and permission controls`
- `e58e3ad feat(room): add granular permissions and comments`
- `7725583 feat(room): add command center and host controls`
- `ae2a54f fix(room): make background refresh silent`

## Recommended Next Steps

1. Confirm the full schema exists in Supabase, especially `rooms`, `room_participants`, `days`, `activity_blocks`, `tasks`, `room_messages`, `room_permission_overrides`, and `room_comments`.
2. Run or rerun `supabase/feature_permissions_todos_comments_patch.sql` after `supabase/schema.sql`.
3. Rerun the authenticated TestSprite test after schema confirmation.
4. If TestSprite hangs again, inspect artifacts or create a narrower plan for:
   - login
   - create room
   - open invite popup
   - open Command tab
   - toggle one selected user's permission
   - create a poll with more than five options
   - create private and public to-dos
   - add comments
   - open chat, send, delete, and clear if allowed
5. Keep app refresh behavior invisible during background polling.
