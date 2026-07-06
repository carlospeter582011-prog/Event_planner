# TestSprite Full Two-Account Run - 2026-07-06

Target URL: `https://event-planner-carlos.vercel.app`

Project: `Synchrona` (`e6c860f4-a64c-460c-bfbb-7a1475e7d64c`)

Test: `Synchrona strict custom two-account full feature flow` (`86f16751-7bda-4ad7-82e5-e142300a5e94`)

Code version: `v2`

Run: `8fb1a815-301e-4066-8c10-206b536d463b`

Result: `passed`

Steps: `16/16 passed`

Started: `2026-07-06T11:17:49.282Z`

Finished: `2026-07-06T11:29:45.926Z`

Dashboard: `https://www.testsprite.com/dashboard/tests/e6c860f4-a64c-460c-bfbb-7a1475e7d64c/test/86f16751-7bda-4ad7-82e5-e142300a5e94`

Video: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783337385711087//tmp/f9cf70a0-8969-4e5e-8332-21c19685b89e/result.webm`

## Coverage

- Host sign-in with `carlospeter582011@gmail.com`.
- Fresh room creation, invite link/code visibility, and Command Center checks.
- Timeline day/activity creation.
- Poll creation, voting, voter visibility, and host poll resolution.
- Timeline/activity/budget comments.
- Private and public task creation and task toggling.
- Chat send and cross-account chat persistence.
- Second-account sign-in with `drpeterramsis2007@gmail.com`.
- Viewer join through room slug, initial Viewer restriction checks, voting, comments, private task, and chat.
- Host permission grant for Viewer timeline, poll, delete-poll, task, comment, and chat capabilities.
- Viewer creates a day/activity/poll, then deletes the poll through the granted `delete_polls` permission.
- Host verifies Viewer-created data, resolves an open poll, revokes timeline edit permission, and performs final cross-tab audit.

## Failure Policy

This run was executed once with a 3600-second wait and no automatic rerun loop, to avoid repeated credit usage. Since it passed, no failure artifact download was needed.
