# Synchrona Phase 5 Smoke Test

Target URL: `https://event-planner-carlos.vercel.app`

Scope:
- Verify the public app loads without a server error.
- Verify the sign-in screen is reachable for unauthenticated users.
- Verify core Synchrona text and navigation affordances render for a headless browser.
- After authentication is available to the test runner, extend this suite to cover room creation, room tabs, participant sidebar, and activity poll workflows.

TestSprite command intent:
`testsprite test create --type frontend --name "Synchrona public smoke test" --description "Verify the deployed Synchrona app loads and exposes the unauthenticated entry flow" --priority p0 --run --wait`
