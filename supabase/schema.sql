-- ====================================================================
-- SYNCHRONA — Complete Database Schema for Supabase
-- Run this entire script in the Supabase SQL Editor.
-- It creates all tables, enums, RLS policies, and triggers.
-- ====================================================================

-- 1. Create ENUM types
-- (Supabase/PostgreSQL enums)

CREATE TYPE public.role AS ENUM ('HOST', 'EDITOR', 'VIEWER');
CREATE TYPE public.activity_status AS ENUM ('PROPOSED', 'CONFIRMED', 'CANCELLED');
CREATE TYPE public.poll_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE public.task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- 2. profiles table (1:1 with Supabase Auth users)
-- This extends auth.users with our app-specific fields.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  total_budget_cap NUMERIC(12, 2) NOT NULL DEFAULT 0,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_host ON public.rooms(host_id);
CREATE INDEX idx_rooms_slug ON public.rooms(slug);

-- 4. room_participants table
CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.role NOT NULL DEFAULT 'VIEWER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_rp_room ON public.room_participants(room_id);
CREATE INDEX idx_rp_user ON public.room_participants(user_id);

-- 5. days table
CREATE TABLE public.days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Day',
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_days_room ON public.days(room_id);
CREATE INDEX idx_days_room_seq ON public.days(room_id, sequence_order);

-- 6. activity_blocks table
CREATE TABLE public.activity_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES public.days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  location TEXT,
  status public.activity_status NOT NULL DEFAULT 'PROPOSED',
  order_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ab_day ON public.activity_blocks(day_id);
CREATE INDEX idx_ab_day_order ON public.activity_blocks(day_id, order_index);
CREATE INDEX idx_ab_status ON public.activity_blocks(status);

-- 7. polls table
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_block_id UUID NOT NULL REFERENCES public.activity_blocks(id) ON DELETE CASCADE,
  question TEXT NOT NULL DEFAULT 'Which option do you prefer?',
  status public.poll_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_polls_activity ON public.polls(activity_block_id);

-- 8. poll_options table
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_poll ON public.poll_options(poll_id);

-- 9. votes table (one vote per user per poll — enforced by trigger)
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_votes_poll_option ON public.votes(poll_option_id);
CREATE INDEX idx_votes_user ON public.votes(user_id);

-- Unique constraint: one vote per user per poll (enforced via poll_id from poll_option)
-- We need a trigger-based approach since poll_id isn't directly on the votes table.

-- Function to prevent duplicate votes (one per user per poll)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_vote()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.votes v
    JOIN public.poll_options po ON v.poll_option_id = po.id
    WHERE po.poll_id = (SELECT poll_id FROM public.poll_options WHERE id = NEW.poll_option_id)
    AND v.user_id = NEW.user_id
    AND v.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'A user can only vote once per poll';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_insert
  BEFORE INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_vote();

-- 10. tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  activity_block_id UUID REFERENCES public.activity_blocks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  priority public.task_priority NOT NULL DEFAULT 'MEDIUM',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_room ON public.tasks(room_id);
CREATE INDEX idx_tasks_activity ON public.tasks(activity_block_id);
CREATE INDEX idx_tasks_completed ON public.tasks(room_id, is_completed);

-- 11. room_messages table (small per-room chat)
CREATE TABLE public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_messages_room_created
  ON public.room_messages(room_id, created_at);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- --- profiles ---
-- Everyone authenticated can read profiles; users can update their own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- --- rooms ---
-- Rooms are viewable by participants or anyone with the link (open read)
CREATE POLICY "Rooms are viewable by anyone authenticated"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Only the host can update room settings (title, description, budget)
CREATE POLICY "Only host can update room"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Only the host can delete the room
CREATE POLICY "Only host can delete room"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- --- room_participants ---
-- Participants are viewable by room participants
CREATE POLICY "Participants can view room participants"
  ON public.room_participants FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM public.room_participants WHERE user_id = auth.uid()
    )
  );

-- Anyone authenticated can be added as a participant (join room)
CREATE POLICY "Authenticated users can be added to rooms"
  ON public.room_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Host can update participant roles; users can leave rooms
CREATE POLICY "Host or self can update participant"
  ON public.room_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Host can remove participants; users can leave
CREATE POLICY "Host or self can delete participant"
  ON public.room_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- --- days ---
CREATE POLICY "Participants can view days"
  ON public.days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
    OR room_id IN (
      SELECT room_id
      FROM public.room_participants
      WHERE user_id = auth.uid()
    )
  );

-- Host/Editor can manage days
CREATE POLICY "Editors can manage days"
  ON public.days FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
    OR room_id IN (
      SELECT room_id
      FROM public.room_participants
      WHERE user_id = auth.uid() AND role IN ('HOST', 'EDITOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
    OR room_id IN (
      SELECT room_id
      FROM public.room_participants
      WHERE user_id = auth.uid() AND role IN ('HOST', 'EDITOR')
    )
  );

-- --- activity_blocks ---
CREATE POLICY "Participants can view activities"
  ON public.activity_blocks FOR SELECT
  TO authenticated
  USING (
    day_id IN (
      SELECT d.id FROM public.days d
      WHERE EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.id = d.room_id AND r.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.room_participants rp
        WHERE rp.room_id = d.room_id AND rp.user_id = auth.uid()
      )
    )
  );

-- Host/Editor can manage activities
CREATE POLICY "Editors can manage activities"
  ON public.activity_blocks FOR ALL
  TO authenticated
  USING (
    day_id IN (
      SELECT d.id FROM public.days d
      WHERE EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.id = d.room_id AND r.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.room_participants rp
        WHERE rp.room_id = d.room_id
          AND rp.user_id = auth.uid()
          AND rp.role IN ('HOST', 'EDITOR')
      )
    )
  )
  WITH CHECK (
    day_id IN (
      SELECT d.id FROM public.days d
      WHERE EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.id = d.room_id AND r.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.room_participants rp
        WHERE rp.room_id = d.room_id
          AND rp.user_id = auth.uid()
          AND rp.role IN ('HOST', 'EDITOR')
      )
    )
  );

-- --- polls ---
CREATE POLICY "Participants can view polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (
    activity_block_id IN (
      SELECT ab.id FROM public.activity_blocks ab
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid()
    )
  );

-- Host/Editor can create/update polls
CREATE POLICY "Editors can manage polls"
  ON public.polls FOR ALL
  TO authenticated
  USING (
    activity_block_id IN (
      SELECT ab.id FROM public.activity_blocks ab
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid() AND rp.role IN ('HOST', 'EDITOR')
    )
  );

-- --- poll_options ---
CREATE POLICY "Participants can view poll options"
  ON public.poll_options FOR SELECT
  TO authenticated
  USING (
    poll_id IN (
      SELECT p.id FROM public.polls p
      JOIN public.activity_blocks ab ON p.activity_block_id = ab.id
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid()
    )
  );

-- Host/Editor can manage poll options
CREATE POLICY "Editors can manage poll options"
  ON public.poll_options FOR ALL
  TO authenticated
  USING (
    poll_id IN (
      SELECT p.id FROM public.polls p
      JOIN public.activity_blocks ab ON p.activity_block_id = ab.id
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid() AND rp.role IN ('HOST', 'EDITOR')
    )
  );

-- --- votes ---
-- Participants can view votes in their rooms
CREATE POLICY "Participants can view votes"
  ON public.votes FOR SELECT
  TO authenticated
  USING (
    poll_option_id IN (
      SELECT po.id FROM public.poll_options po
      JOIN public.polls p ON po.poll_id = p.id
      JOIN public.activity_blocks ab ON p.activity_block_id = ab.id
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid()
    )
  );

-- Any authenticated room participant can vote
CREATE POLICY "Participants can vote"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (
    poll_option_id IN (
      SELECT po.id FROM public.poll_options po
      JOIN public.polls p ON po.poll_id = p.id
      JOIN public.activity_blocks ab ON p.activity_block_id = ab.id
      JOIN public.days d ON ab.day_id = d.id
      JOIN public.room_participants rp ON d.room_id = rp.room_id
      WHERE rp.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own vote (change vote)
CREATE POLICY "Users can update their own votes"
  ON public.votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own vote
CREATE POLICY "Users can delete their own votes"
  ON public.votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- --- tasks ---
CREATE POLICY "Participants can view tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM public.room_participants WHERE user_id = auth.uid()
    )
  );

-- Host/Editor can manage tasks
CREATE POLICY "Editors can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM public.room_participants
      WHERE user_id = auth.uid() AND role IN ('HOST', 'EDITOR')
    )
  );

-- --- room_messages ---
CREATE POLICY "Users with chat permission can view room messages"
  ON public.room_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
    OR room_id IN (
      SELECT room_id
      FROM public.room_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users with chat permission can send room messages"
  ON public.room_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
      )
      OR room_id IN (
        SELECT room_id
        FROM public.room_participants
        WHERE user_id = auth.uid()
      )
    )
  );

-- ====================================================================
-- REALTIME
-- Enable Realtime for key tables so Supabase Realtime subscriptions work
-- ====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.days;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

-- ====================================================================
-- DONE!
-- After running this script:
-- 1. Go to Authentication > Providers and enable "Email" provider
-- 2. Go to Authentication > URL Configuration and set:
--    - Site URL: https://event-planner-carlos.vercel.app
--    - Redirect URLs: https://event-planner-carlos.vercel.app/auth/callback
-- 3. Go to Authentication > Settings and turn OFF "Confirm email" (optional, for easier testing)
-- ====================================================================
