"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { formatCurrency, generateSlug, isUuid, parseRoomIdentifier } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Modal from "@/components/ui/modal";
import type { Role } from "@/types";

export interface RoomRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  total_budget_cap: number;
  host_id: string;
  created_at: string;
  host: { id: string; name: string; avatar_url: string | null };
  my_role: Role;
}

interface DashboardClientProps {
  rooms: RoomRow[];
  userId: string;
  userEmail: string;
  userName: string;
}

export default function DashboardClient({
  rooms,
  userId,
  userEmail,
  userName,
}: DashboardClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinSlug, setJoinSlug] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create room form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("0");

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const slug = generateSlug();

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: userEmail,
            name: userName,
          },
          { onConflict: "id" },
        );

      if (profileError) throw profileError;

      // Insert room
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({
          slug,
          title,
          description: description || null,
          total_budget_cap: parseFloat(budget) || 0,
          host_id: userId,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add creator as HOST participant
      const { error: partError } = await supabase
        .from("room_participants")
        .insert({
          room_id: room.id,
          user_id: userId,
          role: "HOST",
        });

      if (partError) throw partError;

      toast.success("Room created!");
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setBudget("0");
      router.push(`/rooms/${room.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = parseRoomIdentifier(joinSlug);
    if (!roomCode) return;
    setLoading(true);

    const supabase = createClient();

    try {
      const { data: roomBySlug, error: slugError } = await supabase
        .from("rooms")
        .select("id")
        .eq("slug", roomCode)
        .maybeSingle();

      const { data: roomById, error: idError } =
        !roomBySlug && isUuid(roomCode)
          ? await supabase.from("rooms").select("id").eq("id", roomCode).maybeSingle()
          : { data: null, error: null };

      const room = roomBySlug ?? roomById;

      if (slugError || idError || !room) {
        throw new Error("Room not found. Paste the invite link or room code and try again.");
      }

      // Add as VIEWER (ignore conflict if already a participant)
      const { error: insertError } = await supabase
        .from("room_participants")
        .upsert(
          { room_id: room.id, user_id: userId, role: "VIEWER" },
          { onConflict: "room_id,user_id" },
        );

      if (insertError) throw insertError;

      toast.success("Joined room!");
      setJoinOpen(false);
      setJoinSlug("");
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="dashboard-title">
            My Event Rooms
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create or join rooms to start planning events
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="btn-secondary"
            data-testid="btn-join-room"
          >
            Join room
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary"
            data-testid="btn-create-room"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New room
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="mt-6">
        {rooms.length === 0 ? (
          <EmptyState
            testId="empty-rooms"
            title="No rooms yet"
            description="Create your first event room to start planning with your team."
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            action={
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn-primary"
                data-testid="empty-create-room"
              >
                Create your first room
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="rooms-list">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => router.push(`/rooms/${room.id}`)}
                className="card p-5 text-left transition-shadow hover:shadow-md"
                data-testid={`room-card-${room.id}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {room.title}
                  </h3>
                  <Badge variant="role" value={room.my_role}>
                    {room.my_role}
                  </Badge>
                </div>
                {room.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    {room.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Budget: {formatCurrency(room.total_budget_cap)}</span>
                  <span>·</span>
                  <span>{room.host.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Event Room"
      >
        <form onSubmit={handleCreateRoom} data-testid="create-room-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="room-title" className="label">
                Room title <span className="text-red-500">*</span>
              </label>
              <input
                id="room-title"
                name="title"
                type="text"
                required
                placeholder="Annual Team Retreat 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                data-testid="create-room-title"
              />
            </div>
            <div>
              <label htmlFor="room-desc" className="label">
                Description
              </label>
              <textarea
                id="room-desc"
                name="description"
                rows={3}
                placeholder="What's this event about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input resize-none"
                data-testid="create-room-desc"
              />
            </div>
            <div>
              <label htmlFor="room-budget" className="label">
                Total budget cap ($)
              </label>
              <input
                id="room-budget"
                name="total_budget_cap"
                type="number"
                min="0"
                step="0.01"
                placeholder="5000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="input"
                data-testid="create-room-budget"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="btn-secondary"
              data-testid="create-room-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary"
              data-testid="create-room-submit"
            >
              {loading ? <Spinner className="h-4 w-4" /> : "Create room"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a Room"
      >
        <form onSubmit={handleJoinRoom} data-testid="join-room-form">
          <div>
            <label htmlFor="join-slug" className="label">
              Room link or slug
            </label>
            <input
              id="join-slug"
              name="slug"
              type="text"
              required
              placeholder="Paste the room link or UUID slug"
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              onBlur={(e) => setJoinSlug(parseRoomIdentifier(e.target.value))}
              className="input"
              data-testid="join-room-slug"
            />
            <p className="mt-1 text-xs text-slate-500">
              Paste the full invite URL or only the room code. Full links are cleaned automatically.
            </p>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setJoinOpen(false)}
              className="btn-secondary"
              data-testid="join-room-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !joinSlug.trim()}
              className="btn-primary"
              data-testid="join-room-submit"
            >
              {loading ? <Spinner className="h-4 w-4" /> : "Join room"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
