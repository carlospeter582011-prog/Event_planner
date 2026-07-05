"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
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
  roomId: string;
  participants: ParticipantRecord[];
  currentUserId: string;
  currentRole: Role;
  hostName: string;
  onParticipantsChanged?: () => void;
}

const permissionsByRole: Record<Role, string[]> = {
  HOST: [
    "Manage room settings",
    "Edit budget caps",
    "Close or overrule polls",
    "Delete room items",
    "Promote or demote users",
  ],
  EDITOR: [
    "Edit itinerary",
    "Create voting polls",
    "Cast and change votes",
    "Create and complete room tasks",
  ],
  VIEWER: [
    "Read timeline",
    "Track budget",
    "Cast and change votes",
    "Read collaboration state",
  ],
};

export default function ParticipantSidebar({
  roomId,
  participants,
  currentUserId,
  currentRole,
  hostName,
  onParticipantsChanged,
}: ParticipantSidebarProps) {
  const [updatingParticipant, setUpdatingParticipant] = useState<string | null>(null);
  const isCurrentUserHost = currentRole === "HOST";

  async function updateParticipantRole(participant: ParticipantRecord, nextRole: Role) {
    if (!isCurrentUserHost || participant.role === nextRole) return;

    const participantName = participant.profile?.name || "participant";
    const isSelf = participant.profile?.id === currentUserId;

    if (isSelf && nextRole !== "HOST") {
      toast.error("Hosts cannot demote themselves from the room controller.");
      return;
    }

    setUpdatingParticipant(participant.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("room_participants")
      .update({ role: nextRole })
      .eq("id", participant.id)
      .eq("room_id", roomId);

    setUpdatingParticipant(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${participantName} is now ${nextRole}.`);
    onParticipantsChanged?.();
  }

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
                <div className="flex shrink-0 items-center gap-2">
                  {isCurrentUserHost && participant.role !== "HOST" ? (
                    <select
                      value={participant.role}
                      onChange={(event) =>
                        updateParticipantRole(participant, event.target.value as Role)
                      }
                      disabled={updatingParticipant === participant.id}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      aria-label={`Change role for ${displayName}`}
                      data-testid={`participant-role-select-${participant.id}`}
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <Badge variant="role" value={participant.role}>
                      {participant.role}
                    </Badge>
                  )}
                  {updatingParticipant === participant.id && (
                    <Spinner className="h-3.5 w-3.5 text-brand-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {isCurrentUserHost && (
        <section
          className="rounded-lg border border-brand-200 bg-brand-50 p-4 shadow-sm dark:border-brand-900 dark:bg-brand-950/20"
          data-testid="host-user-controller"
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-brand-950 dark:text-brand-100">
              Host User Controller
            </h2>
            <p className="mt-1 text-xs text-brand-800 dark:text-brand-200">
              Assign each collaborator the room capability level they need.
            </p>
          </div>
          <div className="grid gap-2 text-xs">
            {(["HOST", "EDITOR", "VIEWER"] as Role[]).map((permissionRole) => (
              <div key={permissionRole} className="rounded-md bg-white p-2 dark:bg-slate-900">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="role" value={permissionRole}>
                    {permissionRole}
                  </Badge>
                  <span className="text-slate-500">
                    {participants.filter((item) => item.role === permissionRole).length}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {permissionsByRole[permissionRole].join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

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
