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

export type TaskVisibility = "PUBLIC" | "PRIVATE";

export type PermissionKey =
  | "manage_settings"
  | "manage_budget"
  | "manage_itinerary"
  | "manage_polls"
  | "delete_polls"
  | "resolve_polls"
  | "manage_tasks"
  | "create_public_tasks"
  | "delete_items"
  | "manage_users"
  | "vote"
  | "chat"
  | "manage_chat"
  | "manage_comments";

export type RoomPermissions = Record<PermissionKey, boolean>;

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

/** Per-room granular permission override. Null means use the base role default. */
export interface RoomPermissionOverride {
  id: string;
  room_id: string;
  user_id: string;
  can_manage_settings: boolean | null;
  can_manage_budget: boolean | null;
  can_manage_itinerary: boolean | null;
  can_manage_polls: boolean | null;
  can_delete_polls: boolean | null;
  can_resolve_polls: boolean | null;
  can_manage_tasks: boolean | null;
  can_create_public_tasks: boolean | null;
  can_delete_items: boolean | null;
  can_manage_users: boolean | null;
  can_manage_chat: boolean | null;
  can_manage_comments: boolean | null;
  can_vote: boolean | null;
  can_chat: boolean | null;
  created_at: string;
  updated_at: string;
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
  visibility: TaskVisibility;
  owner_id: string;
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
  options: string[]; // 2+ options
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

export const permissionKeys: PermissionKey[] = [
  "manage_settings",
  "manage_budget",
  "manage_itinerary",
  "manage_polls",
  "delete_polls",
  "resolve_polls",
  "manage_tasks",
  "create_public_tasks",
  "delete_items",
  "manage_users",
  "vote",
  "chat",
  "manage_chat",
  "manage_comments",
];

export const permissionColumnByKey: Record<PermissionKey, keyof RoomPermissionOverride> = {
  manage_settings: "can_manage_settings",
  manage_budget: "can_manage_budget",
  manage_itinerary: "can_manage_itinerary",
  manage_polls: "can_manage_polls",
  delete_polls: "can_delete_polls",
  resolve_polls: "can_resolve_polls",
  manage_tasks: "can_manage_tasks",
  create_public_tasks: "can_create_public_tasks",
  delete_items: "can_delete_items",
  manage_users: "can_manage_users",
  vote: "can_vote",
  chat: "can_chat",
  manage_chat: "can_manage_chat",
  manage_comments: "can_manage_comments",
};

export const permissionLabels: Record<PermissionKey, string> = {
  manage_settings: "Edit room settings",
  manage_budget: "Edit budget",
  manage_itinerary: "Add/edit timeline days and activities",
  manage_polls: "Create polls",
  delete_polls: "Delete polls",
  resolve_polls: "Resolve polls",
  manage_tasks: "Manage to-do lists",
  create_public_tasks: "Create public to-dos",
  delete_items: "Delete items",
  manage_users: "Manage users",
  vote: "Vote in polls",
  chat: "Use chat",
  manage_chat: "Moderate chat",
  manage_comments: "Moderate comments",
};

export const roleDefaultPermissions: Record<Role, RoomPermissions> = {
  HOST: {
    manage_settings: true,
    manage_budget: true,
    manage_itinerary: true,
    manage_polls: true,
    delete_polls: true,
    resolve_polls: true,
    manage_tasks: true,
    create_public_tasks: true,
    delete_items: true,
    manage_users: true,
    vote: true,
    chat: true,
    manage_chat: true,
    manage_comments: true,
  },
  EDITOR: {
    manage_settings: false,
    manage_budget: false,
    manage_itinerary: true,
    manage_polls: true,
    delete_polls: false,
    resolve_polls: false,
    manage_tasks: true,
    create_public_tasks: true,
    delete_items: false,
    manage_users: false,
    vote: true,
    chat: true,
    manage_chat: false,
    manage_comments: false,
  },
  VIEWER: {
    manage_settings: false,
    manage_budget: false,
    manage_itinerary: false,
    manage_polls: false,
    delete_polls: false,
    resolve_polls: false,
    manage_tasks: false,
    create_public_tasks: false,
    delete_items: false,
    manage_users: false,
    vote: true,
    chat: true,
    manage_chat: false,
    manage_comments: false,
  },
};

export function resolveRoomPermissions(
  role: Role,
  override?: Partial<RoomPermissionOverride> | null,
): RoomPermissions {
  const defaults = roleDefaultPermissions[role];
  return permissionKeys.reduce((resolved, key) => {
    const column = permissionColumnByKey[key];
    const overrideValue = override?.[column];
    resolved[key] = typeof overrideValue === "boolean" ? overrideValue : defaults[key];
    return resolved;
  }, {} as RoomPermissions);
}
