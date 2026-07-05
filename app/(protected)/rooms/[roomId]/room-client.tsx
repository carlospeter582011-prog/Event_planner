"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import type { Role } from "@/types";
import TimelineView from "./timeline-view";
import TasksView from "./tasks-view";
import BudgetView from "./budget-view";
import ChatView from "./chat-view";
import ParticipantSidebar from "./participant-sidebar";
import RoomNavigation, { type RoomTab } from "./room-navigation";
import Modal from "@/components/ui/modal";

interface RoomClientProps {
  room: Record<string, unknown>;
  role: Role;
  userId: string;
  participants: Record<string, unknown>[];
  roomId: string;
}

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

export default function RoomClient({
  room,
  role,
  userId,
  participants,
  roomId,
}: RoomClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RoomTab>("timeline");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const host = room.host as { id: string; name: string; avatar_url: string | null };
  const roomTitle = room.title as string;
  const roomDescription = room.description as string | null;
  const roomBudgetCap = room.total_budget_cap as number;
  const roomSlug = room.slug as string;
  const typedParticipants = participants as unknown as ParticipantRecord[];
  const isHost = role === "HOST";
  const isEditor = role === "HOST" || role === "EDITOR";

  async function handleLeaveRoom() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Left the room.");
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  const inviteUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/rooms/${roomSlug}`;

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function shareInvite() {
    if (!navigator.share) {
      await copyText(inviteUrl, "Invite link");
      return;
    }

    try {
      await navigator.share({
        title: roomTitle,
        text: `Join ${roomTitle} on Synchrona.`,
        url: inviteUrl,
      });
    } catch {
      toast.error("Share was cancelled.");
    }
  }

  return (
    <div className="space-y-5" data-testid="room-workspace">
      <header
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
        data-testid="room-header"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="truncate text-2xl font-bold text-slate-900 dark:text-white"
                data-testid="room-title"
              >
                {roomTitle}
              </h1>
              <Badge variant="role" value={role}>
                {role}
              </Badge>
              {isHost && (
                <span
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  data-testid="host-controls-indicator"
                >
                  Host controls enabled
                </span>
              )}
              {!isEditor && (
                <span
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  data-testid="viewer-mode-indicator"
                >
                  Viewer mode
                </span>
              )}
            </div>
            {roomDescription && (
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                {roomDescription}
              </p>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  Budget Cap
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(roomBudgetCap)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  Host
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {host?.name || "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  Secure Slug
                </dt>
                <dd
                  className="mt-1 truncate font-mono text-xs text-slate-700 dark:text-slate-300"
                  data-testid="room-slug"
                >
                  {roomSlug}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="btn-secondary text-sm"
              data-testid="btn-copy-link"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Invite
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="btn-secondary text-sm lg:hidden"
              aria-expanded={sidebarOpen}
              aria-controls="mobile-participant-sidebar"
              data-testid="btn-toggle-participants"
            >
              Participants
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="btn-ghost text-sm"
              data-testid="btn-back-dashboard"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div id="mobile-participant-sidebar" className="lg:hidden">
          <ParticipantSidebar
            participants={typedParticipants}
            currentUserId={userId}
            currentRole={role}
            hostName={host?.name || "Unknown"}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5" data-testid="room-main">
          <RoomNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{ participants: typedParticipants.length }}
          />

          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            data-testid="room-tab-content"
          >
            {activeTab === "timeline" && (
              <TimelineView roomId={roomId} role={role} userId={userId} />
            )}
            {activeTab === "tasks" && (
              <TasksView roomId={roomId} role={role} userId={userId} />
            )}
            {activeTab === "budget" && (
              <BudgetView
                roomId={roomId}
                role={role}
                roomBudgetCap={roomBudgetCap}
              />
            )}
            {activeTab === "chat" && (
              <ChatView roomId={roomId} userId={userId} role={role} />
            )}
          </div>

          {role !== "HOST" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
              <button
                type="button"
                onClick={handleLeaveRoom}
                disabled={loading}
                className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-60 dark:text-red-300 dark:hover:text-red-200"
                data-testid="btn-leave-room"
              >
                {loading ? <Spinner className="h-4 w-4" /> : "Leave this room"}
              </button>
            </div>
          )}
        </main>

        <div className="hidden lg:block">
          <div className="sticky top-24">
            <ParticipantSidebar
              participants={typedParticipants}
              currentUserId={userId}
              currentRole={role}
              hostName={host?.name || "Unknown"}
            />
          </div>
        </div>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite to room"
      >
        <div className="space-y-4" data-testid="invite-dialog">
          <div>
            <label className="label" htmlFor="invite-link">
              Invite link
            </label>
            <input
              id="invite-link"
              readOnly
              value={inviteUrl}
              className="input font-mono text-xs"
              data-testid="invite-link-input"
            />
          </div>
          <div>
            <label className="label" htmlFor="invite-code">
              Room code
            </label>
            <input
              id="invite-code"
              readOnly
              value={roomSlug}
              className="input font-mono text-xs"
              data-testid="invite-code-input"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => copyText(inviteUrl, "Invite link")}
              className="btn-secondary justify-center text-sm"
              data-testid="invite-copy-link"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => copyText(roomSlug, "Room code")}
              className="btn-secondary justify-center text-sm"
              data-testid="invite-copy-code"
            >
              Copy code
            </button>
            <button
              type="button"
              onClick={shareInvite}
              className="btn-primary justify-center text-sm"
              data-testid="invite-share"
            >
              Share
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
