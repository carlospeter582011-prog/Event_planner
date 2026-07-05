// ====================================================================
// SYNCHRONA - Core Type Definitions
// Strict TypeScript models matching the Supabase database schema.
// No `any` types anywhere in this codebase.
// ====================================================================

// ---- Enums -------------------------------------------------------------

export type Role = "HOST" | "EDITOR" | "VIEWER";

export type ActivityStatus = "PROPOSED" | "CONFIRMED" | "CANCELLED";

export type PollStatus = "OPEN" | "CLOSED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

// ---- Database Models ---------------------------------------------------

/** 1. User profile (linked 1:1 with Supabase Auth users) */
export interface Profile {
  id: string; // UUID, matches auth.users.id
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string; // ISO timestamp
}

/** 2. Event Room */
export interface Room {
  id: string; // UUID
  slug: string; // unique, non-guessable
  title: string;
  description: string | null;
  total_budget_cap: number; // decimal
  host_id: string; // references Profile.id
  created_at: string;
}

/** 3. Room Participant (join table with role) */
export interface RoomParticipant {
  id: string; // UUID
  room_id: string; // references Room.id
  user_id: string; // references Profile.id
  role: Role;
  joined_at: string;
}

/** 4. Day within a room's itinerary */
export interface Day {
  id: string; // UUID
  room_id: string; // references Room.id
  date: string; // ISO date string (DateTime)
  title: string;
  sequence_order: number;
  created_at: string;
}

/** 5. Activity Block (a scheduled item within a day) */
export interface ActivityBlock {
  id: string; // UUID
  day_id: string; // references Day.id
  title: string;
  description: string | null;
  start_time: string | null; // ISO timestamp
  end_time: string | null; // ISO timestamp
  cost: number; // decimal
  location: string | null;
  status: ActivityStatus;
  order_index: number; // float, for drag/reorder
  created_at: string;
  updated_at: string;
}

/** 6. Poll attached to an activity block */
export interface Poll {
  id: string; // UUID
  activity_block_id: string; // references ActivityBlock.id
  question: string;
  status: PollStatus;
  created_at: string;
  closed_at: string | null;
}

/** 7. Poll Option (alternative venue/time/etc.) */
export interface PollOption {
  id: string; // UUID
  poll_id: string; // references Poll.id
  option_text: string;
  sequence: number;
  created_at: string;
}

/** 8. Vote (one per user per poll) */
export interface Vote {
  id: string; // UUID
  poll_option_id: string; // references PollOption.id
  user_id: string; // references Profile.id
  created_at: string;
}

/** 9. Task (action item, optionally linked to an activity) */
export interface Task {
  id: string; // UUID
  room_id: string; // references Room.id
  activity_block_id: string | null; // nullable
  title: string;
  due_date: string | null; // ISO timestamp
  priority: TaskPriority;
  is_completed: boolean;
  created_at: string;
}

// ---- Relations / Joined Views -----------------------------------------

/** Room with participant + host info eagerly loaded */
export interface RoomWithMeta extends Room {
  participants: (RoomParticipant & { profile: Profile })[];
  host: Profile;
  days_count?: number;
}

/** Activity block with its poll (and poll options/votes) attached */
export interface ActivityWithPoll extends ActivityBlock {
  poll: (Poll & { options: (PollOption & { votes: Vote[] })[] }) | null;
}

// ---- API / Form Payloads ----------------------------------------------

export interface CreateRoomPayload {
  title: string;
  description?: string;
  total_budget_cap: number;
}

export interface CreateActivityPayload {
  day_id: string;
  title: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  cost?: number;
  location?: string;
  status?: ActivityStatus;
}

export interface CreatePollPayload {
  activity_block_id: string;
  question: string;
  options: string[]; // 2-5 options
}

export interface CreateTaskPayload {
  room_id: string;
  activity_block_id?: string | null;
  title: string;
  due_date?: string | null;
  priority?: TaskPriority;
}

// ---- Budget Computation -----------------------------------------------

export interface BudgetSummary {
  total_cap: number;
  allocated: number; // sum of PROPOSED + CONFIRMED activity costs
  confirmed: number; // sum of CONFIRMED only
  remaining: number;
  is_over_budget: boolean;
}

// ---- RBAC Helper -------------------------------------------------------

export const canEdit = (role: Role | undefined | null): boolean =>
  role === "HOST" || role === "EDITOR";

export const isHost = (role: Role | undefined | null): boolean =>
  role === "HOST";
