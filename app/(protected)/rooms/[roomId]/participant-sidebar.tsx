"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import type { PermissionKey, Role, RoomPermissionOverride } from "@/types";
import {
  permissionColumnByKey,
  permissionKeys,
  permissionLabels,
  resolveRoomPermissions,
} from "@/types";

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
  permissionOverrides: RoomPermissionOverride[];
  currentUserId: string;
  currentRole: Role;
  hostName: string;
  onParticipantsChanged?: () => void;
}

const groupedPermissionKeys: { title: string; keys: PermissionKey[] }[] = [
  {
    title: "Room control",
    keys: ["manage_users", "manage_settings", "manage_budget", "delete_items"],
  },
  {
    title: "Planning",
    keys: ["manage_itinerary", "manage_tasks", "create_public_tasks"],
  },
  {
    title: "Polls and communication",
    keys: ["manage_polls", "delete_polls", "resolve_polls", "vote", "chat", "manage_chat", "manage_comments"],
  },
];

export default function ParticipantSidebar({
  roomId,
  participants,
  permissionOverrides,
  currentUserId,
  currentRole,
  hostName,
  onParticipantsChanged,
}: ParticipantSidebarProps) {
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const isCurrentUserHost = currentRole === "HOST";

  function getOverride(userId: string) {
    return permissionOverrides.find((override) => override.user_id === userId) ?? null;
  }

  function getPermissions(participant: ParticipantRecord) {
    return resolveRoomPermissions(
      participant.role,
      participant.profile?.id ? getOverride(participant.profile.id) : null,
    );
  }

  async function updateParticipantPermission(
    participant: ParticipantRecord,
    key: PermissionKey,
    nextValue: boolean,
  ) {
    const userId = participant.profile?.id;
    if (!isCurrentUserHost || !userId || participant.role === "HOST") return;

    const column = permissionColumnByKey[key];
    const loadingKey = `${participant.id}-${key}`;
    const participantName = participant.profile?.name || "participant";

    setUpdatingPermission(loadingKey);
    const supabase = createClient();
    const { error } = await supabase.from("room_permission_overrides").upsert(
      {
        room_id: roomId,
        user_id: userId,
        [column]: nextValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" },
    );

    setUpdatingPermission(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${permissionLabels[key]} updated for ${participantName}.`);
    onParticipantsChanged?.();
  }

  const currentParticipant = participants.find(
    (participant) => participant.profile?.id === currentUserId,
  );
  const currentPermissions = currentParticipant
    ? getPermissions(currentParticipant)
    : resolveRoomPermissions(currentRole);
  const selectedParticipant =
    participants.find((participant) => participant.id === selectedParticipantId) ??
    participants.find((participant) => participant.role !== "HOST") ??
    participants[0] ??
    null;

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
              <button
                key={participant.id}
                type="button"
                onClick={() => isCurrentUserHost && setSelectedParticipantId(participant.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-md border p-2 text-left transition-colors ${
                  selectedParticipant?.id === participant.id && isCurrentUserHost
                    ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/60"
                }`}
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
              </button>
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
              Toggle exact room abilities for each collaborator.
            </p>
          </div>
          {selectedParticipant ? (
            <div className="text-xs">
              {(() => {
                const participant = selectedParticipant;
                const userId = participant.profile?.id;
                const displayName = participant.profile?.name || "Unknown participant";
                const permissions = getPermissions(participant);
                const isLockedHost = participant.role === "HOST";

                return (
                  <article
                    className="rounded-md bg-white p-3 dark:bg-slate-900"
                    data-testid={`permission-toggle-panel-${participant.id}`}
                  >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </p>
                      <p className="text-slate-500">
                        {isLockedHost
                          ? "Host permissions are always enabled"
                          : "Choose what this user can do"}
                      </p>
                    </div>
                    <Badge variant="role" value={participant.role}>
                      {participant.role}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {groupedPermissionKeys.map((group) => (
                      <div key={group.title}>
                        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">
                          {group.title}
                        </p>
                        <div className="grid gap-1.5">
                          {group.keys.map((key) => {
                            const loadingKey = `${participant.id}-${key}`;
                            const disabled = isLockedHost || !userId || updatingPermission === loadingKey;
                            return (
                              <label
                                key={key}
                                className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800"
                              >
                                <span className="min-w-0 pr-2 leading-tight text-slate-700 dark:text-slate-200">
                                  {permissionLabels[key]}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  {updatingPermission === loadingKey && (
                                    <Spinner className="h-3 w-3 text-brand-500" />
                                  )}
                                  <input
                                    type="checkbox"
                                    checked={permissions[key]}
                                    disabled={disabled}
                                    onChange={(event) =>
                                      updateParticipantPermission(participant, key, event.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    data-testid={`permission-toggle-${participant.id}-${key}`}
                                  />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      ))}
                  </div>
                </article>
                );
              })()}
            </div>
          ) : (
            <p className="text-xs text-brand-800 dark:text-brand-200">
              Select a participant to edit permissions.
            </p>
          )}
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
          {permissionKeys.map((permission) => (
            <li key={permission} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  currentPermissions[permission] ? "bg-brand-500" : "bg-slate-300"
                }`}
              />
              <span>{permissionLabels[permission]}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
