# Codex System Instructions & TestSprite Hackathon Framework
## PROJECT TITLE: SYNCHRONA - REAL-TIME COLLABORATIVE EVENT PLANNER WITH AGENTIC VERIFICATION LOOP

## 🎯 Core Project Idea & Background
"Synchrona" is a collaborative, real-time workspace where multiple distributed users can cooperatively organize complex, multi-day event itineraries, vote on activity options, dynamically allocate budgets, assign action items, and manage structured permission boundaries.

Crucially, this application is being developed for the TestSprite Hackathon. Every interactive component must be explicitly testable by a headless cloud browser. Every error state must bubble up predictably with human-readable UI feedback. Every asynchronous mutation must handle loading, success, and error states gracefully.

## 📊 Feature Specifications to Build

### MODULE A: REAL-TIME COLLABORATIVE ROOMS & ITINERARY BUILDER
- Room Management: Users can create an Event Room. The creator is assigned the 'Host' role. The room must generate a unique, non-guessable secure slug or UUID (e.g., `/rooms/e2a8c391-402a...`). Anyone with the link can access the room, but capabilities are strictly determined by roles ('Host', 'Editor', 'Viewer').
- Multi-Day Timeline Structure: The itinerary is divided into discrete 'Days' (e.g., Day 1, Day 2). Each day contains an ordered list of 'Activity Blocks' tracking Title, Description, Times, Estimated Cost, Location, and Status ('Proposed', 'Confirmed', 'Cancelled').
- State Synchronization: Implement a robust synchronization layer using Supabase Realtime bindings or polling. When User A updates a block's time, User B's interface must reflect that update within 500ms without page refreshes.

### MODULE B: DEMOCRATIC ACTIVITY VOTING & PROPOSAL ENGINE
- Activity Alternatives: Editors and Hosts can attach a "Voting Poll" to any unconfirmed Activity Block slot, suggesting 2 to 5 alternative venues or times.
- Granular Voting Logic: Any authenticated user inside the room can cast exactly one vote per active poll and change it dynamically. The UI must render live bar charts or counters showcasing vote distribution.
- Host Overrule and Resolution: Only the 'Host' can manually close a poll. Upon closure, the Host can choose to either auto-commit the highest-voted option or pick an alternative option manually, writing the final state to the database and marking it as 'Confirmed'.

### MODULE C: ROLE-BASED TASK & BUDGET ALLOCATION MATRIX
- Task Delegation Matrix: A separate tab or sidebar rendering an actionable task checklist with Due Dates, Priority Levels, and assigned users, linked to specific Activity Blocks.
- Budget Aggregator Dashboard: The room maintains a global master budget cap set by the Host. Every Activity Block with an estimated cost automatically updates a reactive component displaying: Total Budget Cap, Total Allocated Funds, and Remaining Balance.
- Budget Violation Warnings: If cumulative costs exceed the master budget cap, the system enters a warning state, rendering a highly visible alert banner to all users and blocking the confirmation of further costly activities.
- Granular RBAC (Role-Based Access Control) Enforcement:
  * Host: Full CRUD over settings, budget caps, resetting polls, overrule capabilities, deleting items.
  * Editor: Create/edit activities, propose votes, cast votes, and check/uncheck tasks. Cannot change global budget caps.
  * Viewer: Read-only access to timeline/budget tracker. Can cast votes in open polls but cannot create them.

## 📦 Required Folder Structures
* **Tests**: All automated test cases and configurations must be output directly into `testsprite_tests/`.
* **Logs**: You must append a single descriptive line detailing the mutation state directly to the root-level `LOOP.md` file after every single edit turn.

## 🛰️ Automated Git & Credential Rules
- Active Remote Origin Target: `https://carlospeter582011-prog:<REDACTED_GITHUB_TOKEN>@github.com`
- Automated Flow: For every cycle of building, testing, and fixing a bug:
  1. Update `LOOP.md`.
  2. Stage all modifications (`git add .`).
  3. Commit with structured messages (e.g., `git commit -m "feat(room): initialize phase 3 room management layout"`).
  4. Push directly to remote origin (`git push origin main`) to keep the live Vercel deploy synced.
