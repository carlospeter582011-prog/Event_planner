# Synchrona

Synchrona is a real-time collaborative event planning workspace built for the TestSprite Hackathon. Teams create secure event rooms, build multi-day itineraries, vote on activity options, manage room to-do lists, track budgets, and control participant permissions from a host console.

Production: https://event-planner-carlos.vercel.app

## Core Features

- Secure event rooms with non-guessable slugs and invite links.
- Role-based access control for `HOST`, `EDITOR`, and `VIEWER` participants.
- Host User Controller for promoting or limiting collaborators inside each room.
- Command Center with readiness score, live verification board, budget health, poll count, task progress, and permission matrix.
- Multi-day itinerary builder with activity blocks, costs, locations, status, and drag-friendly ordering.
- Democratic activity voting with 2 to 5 options, one vote per user, live bars, and host resolution.
- Room to-do lists with priority, due dates, completion state, filters, and progress.
- Budget dashboard with cap, allocated spend, confirmed spend, remaining balance, and over-budget warnings.
- Room chat with graceful schema warning if the optional chat table has not been applied.
- Supabase Realtime subscriptions plus polling fallbacks for cloud-browser reliability.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Row Level Security, and Realtime
- TestSprite browser test plans
- Vercel deployment

## Project Structure

```text
app/                         Next.js routes and room workspace views
components/                  Shared UI, providers, and navigation
lib/                         Supabase clients and utility helpers
supabase/schema.sql          Full database schema, RLS policies, and realtime setup
testsprite_tests/            TestSprite plans and test notes
types/                       Strict app and database-facing TypeScript models
resume.md                    Current handoff state for future AI/dev sessions
LOOP.md                      Iteration log required by the hackathon workflow
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Apply the database schema from `supabase/schema.sql` in the Supabase SQL editor.

4. Start the app:

```bash
npm run dev
```

5. Open http://localhost:3000.

## Verification

Build:

```bash
npm run build
```

TestSprite artifacts are stored in `testsprite_tests/`. The authenticated full-site plan covers login, room creation, invite controls, Command Center, Host User Controller, timeline, polls, room to-do lists, budget, and chat.

## Hackathon Notes

Synchrona is designed so every major async workflow has a visible loading, success, empty, or error state. Important UI regions include stable `data-testid` attributes to make headless TestSprite verification deterministic.
