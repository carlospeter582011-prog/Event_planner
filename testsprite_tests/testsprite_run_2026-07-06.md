# TestSprite Production Run - 2026-07-06

Target: `https://event-planner-carlos.vercel.app`

Project: `Synchrona` (`e6c860f4-a64c-460c-bfbb-7a1475e7d64c`)

## Summary

| Test | Test ID | Run ID | Result | Steps |
| --- | --- | --- | --- | --- |
| Public smoke test | `f64fda4a-144a-4b90-9aa8-a822c1f2aedf` | `64251986-29eb-4894-b1bd-7249251ea707` | Passed | 6/6 |
| Authenticated full website flow | `305b4e20-b1f0-4646-b064-5f5d74eb7993` | `2d3ec61d-7a4c-4b5d-ac51-803ba0a4384d` | Failed | 19 passed, 5 failed |
| Two-account room join and RBAC transfer flow | `4c477bd6-27ab-43fa-8889-dd788ad76c95` | `6ca0bcc6-0108-4b0c-ad35-05fb0dbdff43` | Passed | 40/40 |

## Passed Coverage

- Production site loads and public unauthenticated entry flow is reachable.
- First test account can authenticate and reach the dashboard.
- Existing authenticated flow reached an event room, rendered the room title, secure slug, HOST indicator, Timeline tab, participant sidebar, Arrival Day, and Welcome Dinner activity.
- Two-account flow passed: the host account could create/open a room, expose invite details, sign out, switch to the second supplied account, join the room, render both participants, preserve the host role, and return to the host account to inspect participant permissions.
- TestSprite did not report visual overflow or account-identity confusion in the two-account flow.

## Failed Or Bad UI Findings

### Poll Creation Fails Silently

The authenticated full-site flow failed when creating a voting poll for `Welcome Dinner`.

Observed behavior:

- The `Create Voting Poll` modal stayed open after multiple `Create poll` clicks.
- The option fields still showed `Main Hall Buffet` and `Rooftop Dinner`, meaning the submit did not transition to a successful state.
- No poll appeared in the timeline.
- No success toast, inline error, error banner, loading state, or permission message appeared.

Impact:

- Voting and host poll resolution could not be tested in the broad authenticated flow.
- The UI violates the hackathon requirement that asynchronous mutation failures bubble up with human-readable feedback.

Likely area to inspect:

- Poll creation submit handler in the timeline UI.
- Supabase insert path for polls and poll options.
- RLS policies or permission helper for poll creation.
- Production logs for a rejected request or swallowed client exception.

### TestSprite Generated Assertion Weakness

The replay script also contained late assertions that attempted to verify dashboard text after the browser had already navigated into a room. That is a test-generation artifact, not the primary product failure. The real blocking product defect is the silent poll creation failure above.

## Artifacts

- Authenticated failure bundle: `.testsprite/runs/2d3ec61d-7a4c-4b5d-ac51-803ba0a4384d`
- Authenticated failure video: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783293007974809//tmp/f0c1fbd7-95de-43f5-b164-2c04cc333947/result.webm`
- Two-account pass video: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783293879964239//tmp/e0667469-731b-48a2-b9d1-ee15664a64e2/result.webm`

## Next Fix Target

Fix poll creation so the modal shows a loading state, handles Supabase/API errors visibly, closes only on success, refreshes the timeline, and renders the new poll with vote controls. Then rerun `305b4e20-b1f0-4646-b064-5f5d74eb7993`.
