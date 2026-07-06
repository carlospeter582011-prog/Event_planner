# Synchrona Resume for New AI Chat

## Project Overview

Synchrona is a TestSprite Hackathon project: a real-time collaborative event planner for multi-day event rooms. Authenticated users can create secure rooms, invite others by full link or room code, build day-by-day itineraries, create activity voting polls with expandable options, manage private/public to-do lists, write comments across room surfaces, track budget usage, and collaborate through moderated room chat.

The app is a Next.js 16 App Router project with Supabase Auth, Supabase database tables/RLS/realtime, Tailwind CSS, and TestSprite frontend test plans.

## Current Repo and Deployment

- Workspace: `E:\Testsprite_H\Event_Planner`
- GitHub remote: `https://github.com/carlospeter582011-prog/Event_planner`
- Production URL: `https://event-planner-carlos.vercel.app`
- Latest pushed commit at the time of this file: `794769c test(testsprite): add exhaustive two-account coverage`
- Latest verified local build: `npm run build` passed after `20108ed fix(polls): surface creation errors and patch rls`.
- Latest inspected production deployment was Ready and aliased to `https://event-planner-carlos.vercel.app`.
- Working tree was clean before this `resume.md` update.

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

Poll creation was diagnosed after TestSprite reported a silent modal failure. The live Supabase error was:

```text
new row violates row-level security policy for table "polls"
```

The fix in `20108ed fix(polls): surface creation errors and patch rls` did two things:
- Frontend: `app/(protected)/rooms/[roomId]/timeline-view.tsx` now catches poll creation errors, shows an inline `role="alert"` message with `data-testid="create-poll-error"`, keeps the loading state bounded, rolls back a poll row if option insertion fails, closes the modal only after success, and refreshes timeline data after the poll/options are persisted.
- SQL: `supabase/feature_permissions_todos_comments_patch.sql` and standalone `supabase/fix_poll_permissions_patch.sql` explicitly allow direct room hosts through `is_room_host(...)`/`can_room(...)` in poll and poll option policies.

The strict custom TestSprite run later passed poll creation with more than five options on production, so the production flow was working during that run.

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
- `20108ed fix(polls): surface creation errors and patch rls` fixed poll RLS for direct room hosts and added a standalone hotfix file: `supabase/fix_poll_permissions_patch.sql`.

If Supabase reports missing permission columns or RLS failures for `room_permission_overrides` or `polls`, rerun the full `feature_permissions_todos_comments_patch.sql` file. If only poll creation is blocked, the smaller `supabase/fix_poll_permissions_patch.sql` file is the targeted hotfix.

## TestSprite

TestSprite project:
- ID: `e6c860f4-a64c-460c-bfbb-7a1475e7d64c`
- Name: `Synchrona`
- Production target: `https://event-planner-carlos.vercel.app`

Existing tests:
- Public smoke test: `f64fda4a-144a-4b90-9aa8-a822c1f2aedf`
- Authenticated full-site test: `305b4e20-b1f0-4646-b064-5f5d74eb7993`
- Two-account RBAC transfer test: `4c477bd6-27ab-43fa-8889-dd788ad76c95`
- Exhaustive generated full-feature test: `6a72e7ac-ce85-4d32-941e-bd9e8eb1040f`
- Strict custom two-account full-feature test: `86f16751-7bda-4ad7-82e5-e142300a5e94`

The authenticated plan has been expanded to cover the Command Center, readiness metrics, permission matrix, granular Host User Controller toggles, expandable poll options, private/public to-dos, comments, budget comments, chat moderation, and duplicate-room join protection.

Known passing runs:
- Authenticated run `65f0747f-2b81-46bc-a3ea-2ec6679f04c5` passed after the profile self-heal room-creation fix.
- Public smoke run `64251986-29eb-4894-b1bd-7249251ea707` passed 6/6.
- Two-account RBAC transfer run `6ca0bcc6-0108-4b0c-ad35-05fb0dbdff43` passed 40/40.
- Two-account RBAC rerun `92ba955a-b654-4c4e-89a2-a0f4b69d21b2` passed 30/30, but its generated step log was not strong enough to prove every intended second-account feature interaction.
- Strict custom two-account full-feature run `e162d25f-4fb8-4309-a925-c1de352c0cbe` passed. This is the strongest current evidence because the custom Playwright code forces host login, room creation, timeline/activity/poll/task/budget/chat checks, sign-out, second-account login/join/interactions, and host re-entry/cross-account persistence checks.

Important failed or misleading runs:
- Authenticated full-site run `2d3ec61d-7a4c-4b5d-ac51-803ba0a4384d` failed because poll creation was blocked by Supabase RLS and the UI initially failed silently. This led to the `20108ed` poll fix.
- Generated exhaustive run `6584fb7d-df40-47f6-aba2-02d092e5f766` ultimately failed with `routing_404`/element-not-found on an absolute XPath for the Create Poll button. TestSprite's own analysis said the hosted DOM differed from the recorded absolute XPath. Treat this primarily as selector fragility, not proof that the app route returned a real 404.
- Older run `45ae8c15-57c4-4ec4-bb28-8dd5622148fb` was started after SQL/chat changes but remained `running` after extended polling in an earlier chat.

Tracked plans:
- `testsprite_tests/README.md`
- `testsprite_tests/synchrona_public_smoke.plan.json`
- `testsprite_tests/synchrona_authenticated_full_site.plan.json`
- `testsprite_tests/synchrona_command_center_host_controls.plan.json`
- `testsprite_tests/synchrona_two_account_rbac_transfer.plan.json`
- `testsprite_tests/synchrona_exhaustive_two_account_full_feature.plan.json`
- `testsprite_tests/synchrona_strict_two_account_full_feature.py`
- `testsprite_tests/testsprite_run_2026-07-06.md`
- `testsprite_tests/testsprite_exhaustive_run_2026-07-06.md`
- `testsprite_tests/synchrona_phase5_smoke_test.md`

The authenticated plan now includes a full project description for TestSprite: room creation, invite controls, Command Center, granular permissions, timeline, polls, private/public to-dos, comments, budget, and chat moderation.

Test accounts used by the user:
- Email: `carlospeter582011@gmail.com`
- Email: `drpeterramsis2007@gmail.com`
- Password: provided by the user in chat; avoid rewriting it in future artifacts unless strictly required.

Important TestSprite guidance:
- Prefer `testsprite_tests/synchrona_strict_two_account_full_feature.py` for the most reliable full two-account regression.
- Generated TestSprite plans can record brittle absolute XPath selectors. If they fail on an XPath, inspect whether the same control has a stable `data-testid` before treating it as a product bug.

## Commands

Build:

```powershell
npm run build
```

Run existing authenticated TestSprite test:

```powershell
testsprite test run 305b4e20-b1f0-4646-b064-5f5d74eb7993 --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app
```

Run strict custom two-account full-feature TestSprite test:

```powershell
testsprite test run 86f16751-7bda-4ad7-82e5-e142300a5e94 --wait --timeout 3600 --target-url https://event-planner-carlos.vercel.app
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

- `794769c test(testsprite): add exhaustive two-account coverage`
- `20108ed fix(polls): surface creation errors and patch rls`
- `28aeb8b test(testsprite): add two-account rbac run report`
- `5edf5d8 docs: update ai handoff resume`
- `d8e7302 fix(sql): allow hosts to manage permission overrides`
- `384107d fix(budget): contain huge currency values`
- `6595b73 fix(sql): add missing permission columns`
- `1a5cb51 fix(room): improve budget and permission controls`
- `e58e3ad feat(room): add granular permissions and comments`
- `7725583 feat(room): add command center and host controls`
- `ae2a54f fix(room): make background refresh silent`

## Recommended Next Steps

1. If poll creation fails again, first check whether `supabase/fix_poll_permissions_patch.sql` or the newest `feature_permissions_todos_comments_patch.sql` has been applied to the live Supabase project.
2. Use the strict custom TestSprite test (`86f16751-7bda-4ad7-82e5-e142300a5e94`) as the main two-account regression signal.
3. If a generated TestSprite test fails on an absolute XPath, inspect the DOM and prefer stable selectors such as `data-testid` before changing application layout.
4. If the user asks for another production verification, check:
   - Vercel deployment readiness and aliases with `vercel inspect https://event-planner-carlos.vercel.app`
   - Vercel logs with `vercel logs https://event-planner-carlos.vercel.app --since 2h --level error`
   - Supabase env vars with `vercel env ls`
   - TestSprite strict custom run result
5. Keep app refresh behavior invisible during background polling.
