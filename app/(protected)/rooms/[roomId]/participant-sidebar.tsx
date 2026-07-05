"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { Role } from "@/types";

interface ParticipantRecord {
  id: string;
  role: Role;
  joined_at?: string;
  profile?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface ParticipantSidebarProps {
  participants: ParticipantRecord[];
  currentUserId: string;
  currentRole: Role;
  hostName: string;
}

const permissionsByRole: Record<Role, string[]> = {
  HOST: ["Manage room settings", "Edit budget caps", "Close polls", "Delete items"],
  EDITOR: ["Edit itinerary", "Create polls", "Vote", "Update tasks"],
  VIEWER: ["Read timeline", "Track budget", "Vote in open polls"],
};

export default function ParticipantSidebar({
  participants,
  currentUserId,
  currentRole,
  hostName,
}: ParticipantSidebarProps) {
  return (
    <aside
      className="space-y-4"
      aria-label="Room participants and permissions"
      data-testid="participant-sidebar"
    >
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Participants
          </h2>
          <span
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            data-testid="participants-count"
          >
            {participants.length}
          </span>
        </div>

        <div className="space-y-2" data-testid="participants-list">
          {participants.map((participant) => {
            const profile = participant.profile;
            const displayName = profile?.name || "Unknown participant";
            const isCurrentUser = profile?.id === currentUserId;

            return (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-md border border-transparent p-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/60"
                data-testid={`participant-${participant.id}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar
                    name={displayName}
                    avatarUrl={profile?.avatar_url ?? null}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isCurrentUser ? "You" : participant.role === "HOST" ? "Room host" : "Collaborator"}
                    </p>
                  </div>
                </div>
                <Badge variant="role" value={participant.role}>
                  {participant.role}
                </Badge>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        data-testid="rbac-summary"
      >
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Access Level
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Hosted by {hostName || "Unknown"}
          </p>
        </div>
        <Badge variant="role" value={currentRole}>
          {currentRole}
        </Badge>
        <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          {permissionsByRole[currentRole].map((permission) => (
            <li key={permission} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              <span>{permission}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
