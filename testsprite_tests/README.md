# Synchrona TestSprite Test Suite

Target production URL: `https://event-planner-carlos.vercel.app`

Project ID: `e6c860f4-a64c-460c-bfbb-7a1475e7d64c`

## Test Artifacts

- `synchrona_public_smoke.plan.json` verifies the unauthenticated entry flow and sign-in route.
- `synchrona_authenticated_full_site.plan.json` verifies the full host workflow from login through room creation, Command Center, timeline, polls, tasks, budget, and chat.
- `synchrona_command_center_host_controls.plan.json` verifies the Command Center, Host User Controller, granular permission toggles, private/public to-dos, comments, and moderation surfaces with a narrower scope than the full workflow.
- `synchrona_two_account_rbac_transfer.plan.json` verifies host-to-second-account room access, participant visibility, and RBAC boundaries across the two supplied test accounts.
- `synchrona_exhaustive_two_account_full_feature.plan.json` is a broad generated-plan regression for all major Synchrona surfaces.
- `synchrona_strict_two_account_full_feature.py` is a custom Playwright-backed TestSprite script that forces real host/second-account switching and cross-account data checks.
- `testsprite_run_2026-07-06.md` records the latest production TestSprite run results and findings.
- `../supabase/feature_permissions_todos_comments_patch.sql` must be applied before running the newest authenticated plans.
- `synchrona_phase5_smoke_test.md` records the operational smoke-test intent and CLI commands.

## Recommended Run Order

1. Public smoke test for deployment reachability.
2. Command Center and Host Controls test for the newest room features.
3. Authenticated full-site flow for end-to-end regression coverage.

## Existing Test IDs

- Public smoke test: `f64fda4a-144a-4b90-9aa8-a822c1f2aedf`
- Authenticated full-site test: `305b4e20-b1f0-4646-b064-5f5d74eb7993`
- Two-account RBAC transfer test: `4c477bd6-27ab-43fa-8889-dd788ad76c95`
- Exhaustive generated full-feature test: `6a72e7ac-ce85-4d32-941e-bd9e8eb1040f`
- Strict custom two-account full-feature test: `86f16751-7bda-4ad7-82e5-e142300a5e94`

## Useful Commands

```powershell
testsprite test run f64fda4a-144a-4b90-9aa8-a822c1f2aedf --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app
testsprite test run 305b4e20-b1f0-4646-b064-5f5d74eb7993 --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app
testsprite test run 4c477bd6-27ab-43fa-8889-dd788ad76c95 --wait --timeout 360 --target-url https://event-planner-carlos.vercel.app
testsprite test run 6a72e7ac-ce85-4d32-941e-bd9e8eb1040f --wait --timeout 3600 --target-url https://event-planner-carlos.vercel.app
testsprite test run 86f16751-7bda-4ad7-82e5-e142300a5e94 --wait --timeout 3600 --target-url https://event-planner-carlos.vercel.app
```

If a run times out while still active, resume polling instead of creating a duplicate:

```powershell
testsprite test wait <run-id> --timeout 360
```
