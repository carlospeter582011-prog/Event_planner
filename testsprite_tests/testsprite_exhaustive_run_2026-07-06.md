# TestSprite Exhaustive Production Run - 2026-07-06

Target: `https://event-planner-carlos.vercel.app`

Project: `Synchrona` (`e6c860f4-a64c-460c-bfbb-7a1475e7d64c`)

## Executive Summary

I ran three production TestSprite checks for this cycle:

| Test | Test ID | Run ID | Result | What it proved |
| --- | --- | --- | --- | --- |
| Exhaustive generated full-feature regression | `6a72e7ac-ce85-4d32-941e-bd9e8eb1040f` | `6584fb7d-df40-47f6-aba2-02d092e5f766` | Failed | TestSprite reached auth, dashboard, invite, Command, and Timeline, then failed on a brittle XPath replay for the Create Poll button. |
| Two-account RBAC transfer rerun | `4c477bd6-27ab-43fa-8889-dd788ad76c95` | `92ba955a-b654-4c4e-89a2-a0f4b69d21b2` | Passed | TestSprite confirmed the two-account room/RBAC transfer test still passes, but its generated step log did not strongly prove all second-account feature interactions in the latest run. |
| Strict custom two-account full-feature script | `86f16751-7bda-4ad7-82e5-e142300a5e94` | `e162d25f-4fb8-4309-a925-c1de352c0cbe` | Passed | The custom Playwright code forced host login, fresh room creation, timeline/poll/task/budget/chat interactions, sign-out, second-account join/interactions, then host re-entry and cross-account persistence checks. |

## Important Interpretation

The generated TestSprite plans are useful for broad exploration, but they can replay against absolute XPath selectors. The latest exhaustive generated run failed because TestSprite could not find:

`xpath=/html/body/div[2]/div/div/div/div/main/div/div/div[3]/div/div[2]/div/div[2]/button`

That was reported as `routing_404`, but the root cause text says the hosted app rendered a different DOM than the recorded selector expected. This is a TestSprite replay fragility and selector stability issue, not proof that the app returned a real browser 404.

To avoid relying on that brittle generated replay, I added and ran `synchrona_strict_two_account_full_feature.py`, a custom code-file test that uses stable `data-testid` selectors where available and explicitly controls both accounts.

## Strict Custom Test Coverage

The strict custom TestSprite script executed the following user story against production:

1. Open public landing page and verify sign-in entry exists.
2. Sign in as `carlospeter582011@gmail.com`.
3. Verify dashboard room creation and join controls.
4. Create a fresh event room with a unique title and budget cap.
5. Verify room workspace, room title, slug, host badge, and main navigation tabs.
6. Verify Command Center and Host User Controller surfaces render for the host.
7. Create an itinerary day named `Arrival Day`.
8. Create an activity named `Welcome Dinner` with description, cost, location, and proposed status.
9. Create a poll with more than five options.
10. Verify the poll appears instead of silently failing.
11. Add a host timeline comment.
12. Create a host private task named `Confirm catering`.
13. Open Budget and verify budget-related UI is present.
14. Send a host chat message.
15. Sign out from host.
16. Sign in as `drpeterramsis2007@gmail.com`.
17. Join the exact room created by the host.
18. Verify the same room opens for the second account.
19. Vote in the host-created poll.
20. Add a second-account timeline comment.
21. Send a second-account chat message.
22. Verify the second account does not see the Host User Controller.
23. Sign out from second account.
24. Sign back in as host.
25. Reopen the same room.
26. Verify second-account participant/content is visible to host.
27. Verify second-account chat and comment persisted.

## Current Findings

### Passed

- Public app entry is reachable.
- Host account authentication works.
- Dashboard controls are present.
- Room creation works.
- Secure room route opens.
- Host role is visible.
- Command, Timeline, Tasks, Budget, and Chat tabs are available.
- Invite/room access flow is present.
- Timeline day creation works.
- Activity creation works.
- Poll creation with more than five options works in the strict custom flow.
- Poll voting works in the strict custom flow.
- Timeline comments work.
- Task creation works.
- Budget screen is reachable.
- Chat send works.
- Second account can sign in and join the host-created room.
- Second account can interact with allowed room surfaces.
- Second account is blocked from seeing host-only permission controls.
- Host can return and observe second-account room data.

### Failed Or Risky

- The generated exhaustive TestSprite test is brittle because it recorded an absolute XPath for a timeline button. If the page state changes, the replay fails even when the app has a stable `data-testid` available.
- TestSprite's generated step logs for code-file tests are very high-level and do not show every internal Playwright assertion. The strict script pass is still meaningful because a failed internal assertion would fail the code-file test, but the dashboard step list is not detailed.
- Older generated tests in the project still include stale failures from before the poll/RLS work and from brittle generated selectors. Prefer the strict custom test for the strongest two-account evidence.

## Videos

- Strict custom two-account pass: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783297311564357//tmp/5122d86d-d000-469c-83da-a5d0dba508e8/result.webm`
- Generated exhaustive XPath failure: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783296254641754//tmp/test_task/result.webm`
- Two-account RBAC rerun pass: `https://testsprite-videos.s3.us-east-1.amazonaws.com/0458c498-b021-700a-1bf1-f9051cd40017/1783296751991448//tmp/5a0cc6b3-e63b-4b6b-8399-bbb67b18eff9/result.webm`

## Recommendation

Keep `synchrona_strict_two_account_full_feature.py` as the main full-regression test because it forces exact account switching and uses stable selectors. For generated TestSprite tests, replace absolute-XPath dependent actions with code-file tests or narrower plans that target `data-testid` controls.
