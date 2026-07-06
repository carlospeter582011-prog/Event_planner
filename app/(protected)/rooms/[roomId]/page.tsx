import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import RoomClient from "./room-client";
import type { Role } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;
  if (!isSupabaseConfigured()) {
    redirect("/auth/signin?error=supabase_config_missing");
  }

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
  const hostId = (room as { host_id: string }).host_id;
  const currentUserIsHost = hostId === user.id;

  const { data: participant } = await supabase
    .from("room_participants")
    .select("id, role")
    .eq("room_id", resolvedRoomId)
    .eq("user_id", user.id)
    .maybeSingle();

  let role = (participant as { id: string; role: Role } | null)?.role ?? null;

  if (!role) {
    await supabase.from("room_participants").insert({
      room_id: resolvedRoomId,
      user_id: user.id,
      role: currentUserIsHost ? "HOST" : "VIEWER",
    });
    role = currentUserIsHost ? "HOST" : "VIEWER";
  } else if (currentUserIsHost && role !== "HOST") {
    await supabase
      .from("room_participants")
      .update({ role: "HOST" })
      .eq("id", (participant as { id: string }).id);
    role = "HOST";
  }

  const { data: participants } = await supabase
    .from("room_participants")
    .select("*, profile:profiles(id, name, avatar_url)")
    .eq("room_id", resolvedRoomId)
    .order("joined_at", { ascending: true });

  const { data: permissionOverrides } = await supabase
    .from("room_permission_overrides")
    .select("*")
    .eq("room_id", resolvedRoomId);

  return (
    <RoomClient
      room={room as Record<string, unknown>}
      role={role}
      userId={user.id}
      participants={(participants as Record<string, unknown>[]) ?? []}
      permissionOverrides={(permissionOverrides as Record<string, unknown>[]) ?? []}
      roomId={resolvedRoomId}
    />
  );
}
