import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RoomClient from "./room-client";
import type { Role } from "@/types";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: roomById } = await supabase
    .from("rooms")
    .select("*, host:profiles(id, name, avatar_url)")
    .eq("id", roomId)
    .maybeSingle();

  const { data: roomBySlug } = roomById
    ? { data: null }
    : await supabase
        .from("rooms")
        .select("*, host:profiles(id, name, avatar_url)")
        .eq("slug", roomId)
        .maybeSingle();

  const room = roomById ?? roomBySlug;

  if (!room) redirect("/dashboard");

  const resolvedRoomId = (room as { id: string }).id;

  const { data: participant } = await supabase
    .from("room_participants")
    .select("role")
    .eq("room_id", resolvedRoomId)
    .eq("user_id", user.id)
    .maybeSingle();

  let role = (participant as { role: Role } | null)?.role ?? null;

  if (!role) {
    await supabase.from("room_participants").insert({
      room_id: resolvedRoomId,
      user_id: user.id,
      role: "VIEWER",
    });
    role = "VIEWER";
  }

  const { data: participants } = await supabase
    .from("room_participants")
    .select("*, profile:profiles(id, name, avatar_url)")
    .eq("room_id", resolvedRoomId)
    .order("joined_at", { ascending: true });

  return (
    <RoomClient
      room={room as Record<string, unknown>}
      role={role}
      userId={user.id}
      participants={(participants as Record<string, unknown>[]) ?? []}
      roomId={resolvedRoomId}
    />
  );
}
