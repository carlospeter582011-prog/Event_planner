import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";
import type { RoomRow } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch rooms where user is a participant
  const { data: participants } = await supabase
    .from("room_participants")
    .select("room_id, role")
    .eq("user_id", user!.id);

  const roomIds =
    (participants as { room_id: string; role: string }[] | null)?.map(
      (p) => p.room_id,
    ) ?? [];

  // Fetch room details with host profile
  const { data: rooms } = await supabase
    .from("rooms")
    .select(
      `
      *,
      host:profiles(id, name, avatar_url)
    `,
    )
    .in("id", roomIds)
    .order("created_at", { ascending: false });

  // Merge in the user's role for each room
  const raw = rooms as Record<string, unknown>[] | null;
  const typedRooms: RoomRow[] = raw?.map((room) => {
    const match = (participants as { room_id: string; role: string }[] | null)?.find(
      (p) => p.room_id === room.id,
    );
    return {
      id: room.id as string,
      slug: room.slug as string,
      title: room.title as string,
      description: room.description as string | null,
      total_budget_cap: room.total_budget_cap as number,
      host_id: room.host_id as string,
      created_at: room.created_at as string,
      host: room.host as RoomRow["host"],
      my_role: (match?.role as RoomRow["my_role"]) ?? "VIEWER",
    };
  }) ?? [];

  return <DashboardClient rooms={typedRooms} userId={user!.id} />;
}
