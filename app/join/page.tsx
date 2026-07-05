import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ slug?: string }>;
}

/**
 * Handles invite links: /join?slug=xxx
 * Adds the user as a VIEWER participant and redirects to the room.
 */
export default async function JoinPage({ searchParams }: PageProps) {
  const { slug } = await searchParams;
  if (!isSupabaseConfigured()) {
    redirect("/auth/signin?error=supabase_config_missing");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signin?redirect=${encodeURIComponent(`/join?slug=${slug || ""}`)}`);
  }

  if (!slug) redirect("/dashboard");

  // Find room by slug
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) redirect("/dashboard?error=room_not_found");

  // Add as VIEWER (upsert handles re-join)
  await supabase
    .from("room_participants")
    .upsert(
      { room_id: (room as { id: string }).id, user_id: user.id, role: "VIEWER" },
      { onConflict: "room_id,user_id" },
    );

  redirect(`/rooms/${(room as { id: string }).id}`);
}
