# Synchrona Phase 5 Smoke Test

Target URL: `https://event-planner-carlos.vercel.app`

Scope:
- Verify the public app loads without a server error.
- Verify the sign-in screen is reachable for unauthenticated users.
- Verify core Synchrona text and navigation affordances render for a headless browser.
- Verify authenticated room creation, duplicate-room join protection, room tabs, participant sidebar, granular Host User Controller toggles, activity poll workflows with more than five options, private/public to-do lists, comments, budget dashboard, chat moderation, Command Center metrics, and permission summaries.

SQL prerequisite:
Run `supabase/feature_permissions_todos_comments_patch.sql` in Supabase before authenticated tests.

TestSprite command intent:
`testsprite test create --type frontend --name "Synchrona public smoke test" --description "Verify the deployed Synchrona app loads and exposes the unauthenticated entry flow" --priority p0 --run --wait`

Focused newest-feature command intent:
`testsprite test create --project e6c860f4-a64c-460c-bfbb-7a1475e7d64c --type frontend --name "Synchrona command center and host controls" --description "Verify Command Center readiness metrics, live verification board, permission matrix, and Host User Controller surfaces" --priority p0 --run --wait --target-url https://event-planner-carlos.vercel.app`

Known long-running authenticated command:
`testsprite test run 305b4e20-b1f0-4646-b064-5f5d74eb7993 --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app`
